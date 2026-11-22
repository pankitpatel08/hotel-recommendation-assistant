import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Journey from "./Journey";

const EXAMPLE =
  "Find a Wellington hotel for two nights, up to NZD 250 per night; breakfast preferred.";

const HOTELS = [
  {
    id: "h1",
    name: "Harbour House",
    nightlyPrice: 220,
    currency: "NZD",
    breakfastIncluded: true,
    explanation: "Within budget; breakfast included.",
  },
  {
    id: "h2",
    name: "City Garden",
    nightlyPrice: 245,
    currency: "NZD",
    breakfastIncluded: true,
    explanation: "Near the meeting district.",
  },
  {
    id: "h3",
    name: "Quay Rooms",
    nightlyPrice: 195,
    currency: "NZD",
    breakfastIncluded: false,
    explanation: "Lower price; breakfast costs extra.",
  },
];
const SUCCESS_BODY = {
  message: "Demo fixture data: here are three Wellington hotels.",
  hotels: HOTELS,
};
const EMPTY_BODY = {
  message: "Demo fixture data: no hotels matched this request.",
  hotels: [],
};
const ERROR_BODY = {
  code: "service_unavailable",
  message:
    "The recommendation service is temporarily unavailable. Please try again.",
};

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function setup() {
  const user = userEvent.setup();
  render(<Journey />);
  return user;
}

const clickSearch = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "Search Hotels" }));

async function searchAndWaitForCards(user: ReturnType<typeof userEvent.setup>) {
  fetchMock.mockResolvedValueOnce(reply(SUCCESS_BODY));
  await clickSearch(user);
  return screen.findAllByRole("article");
}

describe("request form", () => {
  it("shows the heading, the example request, the scenario control and the search button", () => {
    setup();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Hotel Recommendation Assistant",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Hotel request")).toHaveValue(EXAMPLE);
    const options = within(screen.getByLabelText("Demo scenario")).getAllByRole(
      "option",
    );
    expect(options.map((o) => o.textContent)).toEqual([
      "Success",
      "Empty",
      "Error",
    ]);
    expect(screen.getByRole("button", { name: "Search Hotels" })).toBeEnabled();
  });

  it("rejects a blank message with inline feedback, focus on the field, and no API call", async () => {
    const user = setup();
    const input = screen.getByLabelText("Hotel request");
    await user.clear(input);
    await user.type(input, "   ");
    await clickSearch(user);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a hotel request",
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows loading, disables the button, and does not send a duplicate request", async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => (finish = resolve)),
    );
    const user = setup();
    await clickSearch(user);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Searching for hotels",
    );
    const busyButton = screen.getByRole("button", { name: "Searching…" });
    expect(busyButton).toBeDisabled();
    await user.click(busyButton);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    finish(reply(SUCCESS_BODY));
    expect(await screen.findAllByRole("article")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Search Hotels" })).toBeEnabled();
  });
});

describe("results", () => {
  it("sends the trimmed message and scenario, then shows the assistant message and every card field", async () => {
    const user = setup();
    const cards = await searchAndWaitForCards(user);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/recommendations$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      message: EXAMPLE,
      scenario: "success",
    });

    expect(screen.getByText(SUCCESS_BODY.message)).toBeInTheDocument();
    expect(cards).toHaveLength(3);

    const first = within(cards[0]);
    expect(
      first.getByRole("heading", { name: "Harbour House" }),
    ).toBeInTheDocument();
    expect(first.getByText(/NZD\s*220/)).toBeInTheDocument();
    expect(first.getByText("Breakfast included")).toBeInTheDocument();
    expect(
      first.getByText("Within budget; breakfast included."),
    ).toBeInTheDocument();

    const third = within(cards[2]);
    expect(third.getByText(/NZD\s*195/)).toBeInTheDocument();
    expect(third.getByText("Breakfast not included")).toBeInTheDocument();
  });

  // message input + trimming (request form)
  it("sends what the traveller typed, trimmed of surrounding whitespace", async () => {
    fetchMock.mockResolvedValueOnce(reply(SUCCESS_BODY));
    const user = setup();
    const input = screen.getByLabelText("Hotel request");
    await user.clear(input);
    await user.type(input, "  Two nights in Wellington, near the harbour  ");
    expect(input).toHaveValue("  Two nights in Wellington, near the harbour  ");
    await clickSearch(user);
    await screen.findAllByRole("article");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).message).toBe(
      "Two nights in Wellington, near the harbour",
    );
  });

  // validation message clears (request form)
  it("clears the validation message once the traveller types again", async () => {
    const user = setup();
    const input = screen.getByLabelText("Hotel request");
    await user.clear(input);
    await clickSearch(user);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await user.type(input, "Wellington");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  // all three cards, every field (results)
  it("renders all three hotels with name, price, currency, breakfast and explanation", async () => {
    const user = setup();
    const cards = await searchAndWaitForCards(user);
    expect(cards).toHaveLength(3);
    HOTELS.forEach((hotel, index) => {
      const card = within(cards[index]);
      expect(
        card.getByRole("heading", { name: hotel.name }),
      ).toBeInTheDocument();
      expect(
        card.getByText(
          new RegExp(`${hotel.currency}\\s*${hotel.nightlyPrice}\\b`),
        ),
      ).toBeInTheDocument();
      expect(
        card.getByText(
          hotel.breakfastIncluded
            ? "Breakfast included"
            : "Breakfast not included",
        ),
      ).toBeInTheDocument();
      expect(card.getByText(hotel.explanation)).toBeInTheDocument();
    });
  });

  it("shows the empty state and keeps the form editable for the empty scenario", async () => {
    fetchMock.mockResolvedValueOnce(reply(EMPTY_BODY));
    const user = setup();
    await user.selectOptions(screen.getByLabelText("Demo scenario"), "empty");
    await clickSearch(user);

    expect(
      await screen.findByRole("heading", { name: "No hotels found" }),
    ).toBeInTheDocument();
    expect(screen.getByText(EMPTY_BODY.message)).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).scenario).toBe("empty");
    expect(screen.getByLabelText("Hotel request")).not.toHaveAttribute(
      "readonly",
    );
    expect(screen.getByRole("button", { name: "Search Hotels" })).toBeEnabled();
  });
});

describe("selection", () => {
  it("selects with the keyboard, shows a summary, and replaces the selection", async () => {
    const user = setup();
    await searchAndWaitForCards(user);

    screen.getByRole("button", { name: "Select City Garden" }).focus();
    await user.keyboard("{Enter}");

    let summary = within(
      screen.getByRole("region", { name: "Your selection" }),
    );
    expect(summary.getByText("City Garden")).toBeInTheDocument();
    expect(summary.getByText(/NZD\s*245/)).toBeInTheDocument();
    expect(summary.getByText("Breakfast included")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Selected City Garden" }),
    ).toHaveAttribute("aria-pressed", "true");

    screen.getByRole("button", { name: "Select Quay Rooms" }).focus();
    await user.keyboard(" ");

    summary = within(screen.getByRole("region", { name: "Your selection" }));
    expect(summary.getByText("Quay Rooms")).toBeInTheDocument();
    expect(summary.getByText("Breakfast not included")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Select City Garden" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(1);
  });

  it("clears the selection when a new search is made", async () => {
    const user = setup();
    await searchAndWaitForCards(user);
    await user.click(
      screen.getByRole("button", { name: "Select Harbour House" }),
    );
    expect(
      screen.getByRole("region", { name: "Your selection" }),
    ).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(reply(EMPTY_BODY));
    await clickSearch(user);

    expect(
      await screen.findByRole("heading", { name: "No hotels found" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Your selection" }),
    ).not.toBeInTheDocument();
  });
});

describe("failures", () => {
  it("shows the 503 message, then Retry re-sends the same request and recovers", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(ERROR_BODY, 503))
      .mockResolvedValueOnce(reply(SUCCESS_BODY));
    const user = setup();
    await user.selectOptions(screen.getByLabelText("Demo scenario"), "error");
    await clickSearch(user);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(ERROR_BODY.message);

    await user.click(within(alert).getByRole("button", { name: "Retry" }));

    expect(await screen.findAllByRole("article")).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(
      JSON.parse(fetchMock.mock.calls[0][1].body),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Hotel request")).toHaveValue(EXAMPLE);
  });

  it("treats an unreachable API as recoverable", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(reply(SUCCESS_BODY));
    const user = setup();
    await clickSearch(user);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/could not reach/i);

    await user.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await screen.findAllByRole("article")).toHaveLength(3);
  });

  it("treats a malformed 200 response as an error, not a crash", async () => {
    fetchMock.mockResolvedValueOnce(
      reply({ message: "ok", hotels: "not-a-list" }),
    );
    const user = setup();
    await clickSearch(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /unexpected response/i,
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows a 422 message without offering Retry", async () => {
    fetchMock.mockResolvedValueOnce(
      reply(
        {
          code: "validation_error",
          message: "Scenario must be one of: success, empty, error.",
        },
        422,
      ),
    );
    const user = setup();
    await clickSearch(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Scenario must be one of",
    );
    expect(
      screen.queryByRole("button", { name: "Retry" }),
    ).not.toBeInTheDocument();
  });
});
