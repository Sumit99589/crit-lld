import type { Problem, ProblemCatalog } from "../domain/problem.js";

// Four problems that each lean on a different core LLD skill:
// parking lot -> responsibilities and variation in pricing,
// vending machine -> state-dependent behaviour,
// expense sharing -> validation and a family of algorithms,
// elevator -> scheduling policy and concurrency.

export const PROBLEMS: Problem[] = [
  {
    slug: "parking-lot",
    title: "Parking Lot",
    difficulty: "easy",
    estimatedMinutes: 35,
    tagline: "Assign spots, issue tickets, charge on exit.",
    context:
      "A multi-storey garage at a city mall wants software for its entry and exit gates. Motorcycles, cars and vans arrive at any of several entry gates. The system has to find a suitable spot, issue a ticket, and charge the driver when they leave.",
    requirements: [
      { id: "FR-1", text: "The lot has several floors, and each floor has spots of different sizes: compact, regular and large." },
      { id: "FR-2", text: "Motorcycles, cars and vans may only park in spots that fit them." },
      { id: "FR-3", text: "At an entry gate the system assigns a free, suitable spot and issues a ticket recording the entry time." },
      { id: "FR-4", text: "At an exit gate the system calculates the fee from the ticket's duration and the vehicle type's hourly rate, takes payment, and frees the spot." },
      { id: "FR-5", text: "A display board at each entry shows how many spots of each size are free." },
      { id: "FR-6", text: "If no suitable spot is free, the vehicle is refused entry with a clear reason." },
    ],
    constraints: [
      "Two entry gates can ask for a spot at the same moment; one spot must never be given to two vehicles.",
      "Pricing rules change often (weekend rates, first hour free).",
      "Payment can be cash or card.",
    ],
    outOfScope: ["Online reservations", "Number-plate recognition hardware", "Managing more than one lot"],
    changeScenario: {
      title: "EV charging",
      prompt:
        "The mall adds EV charging spots on two floors. Electric cars should get a charging spot when one is free, and charging is billed per kWh on top of the parking fee.",
    },
    coreConcepts: [
      { name: "Parking spot", aliases: ["spot", "slot", "space", "bay"], whyItMatters: "Spots are what gets allocated, sized and freed." },
      { name: "Ticket", aliases: ["ticket", "receipt", "token", "session"], whyItMatters: "Something has to remember when a vehicle entered and where it parked." },
      { name: "Vehicle", aliases: ["vehicle", "car"], whyItMatters: "Vehicle type decides which spots fit and what rate applies." },
      { name: "Pricing", aliases: ["fee", "pricing", "price", "rate", "tariff", "charge"], whyItMatters: "Fee rules change often, so they usually deserve their own home." },
      { name: "Floor", aliases: ["floor", "level", "storey"], whyItMatters: "Spots are organised by floor." },
      { name: "Gate", aliases: ["gate", "entry", "exit", "entrance"], whyItMatters: "Gates are where requests come from and where concurrency shows up." },
    ],
    hints: [
      "Start from the nouns in the requirements, then ask which ones have behaviour and not just data.",
      "Pricing changes often. That tells you where variation lives.",
      "Decide who chooses a vehicle's spot, and what happens when two gates ask at once.",
    ],
  },
  {
    slug: "vending-machine",
    title: "Vending Machine",
    difficulty: "medium",
    estimatedMinutes: 40,
    tagline: "Take money, dispense, make change, never lose a coin.",
    context:
      "An office lobby has a snack machine that accepts coins and notes, dispenses one product per sale, and returns change. Operators restock it and collect cash once a week.",
    requirements: [
      { id: "FR-1", text: "The machine holds products in numbered slots, each with a price and a quantity." },
      { id: "FR-2", text: "A customer selects a slot, inserts coins or notes of supported denominations, and receives the product once enough money has been inserted." },
      { id: "FR-3", text: "The machine returns change from the coins it holds; if it cannot make exact change, it cancels the sale and refunds everything inserted." },
      { id: "FR-4", text: "The customer can cancel at any point before the product is dispensed and get a full refund." },
      { id: "FR-5", text: "Selecting an empty or unknown slot is rejected with a message." },
      { id: "FR-6", text: "An operator can restock products and refill or collect coins in maintenance mode; no sales happen during maintenance." },
    ],
    constraints: [
      "The machine behaves differently depending on what has happened so far (idle, money inserted, dispensing, maintenance). Actions that make no sense right now must be rejected, not crash.",
      "Money must never be lost: every inserted coin is either kept for a completed sale or returned.",
    ],
    outOfScope: ["Remote telemetry", "Multiple currencies", "Product recommendations"],
    changeScenario: {
      title: "Card payments",
      prompt:
        "The machine gets a card reader. Customers can pay by card instead of cash (no change involved), and card payments can be declined or time out.",
    },
    coreConcepts: [
      { name: "Product", aliases: ["product", "item", "snack"], whyItMatters: "Products carry the price being paid." },
      { name: "Slot", aliases: ["slot", "inventory", "rack", "shelf", "stock"], whyItMatters: "Stock is tracked per slot and can run out." },
      { name: "Money", aliases: ["coin", "cash", "money", "denomination", "note", "balance"], whyItMatters: "Inserted money and the coin float are what must never be lost." },
      { name: "Machine state", aliases: ["state", "idle", "mode"], whyItMatters: "Which actions are valid depends on what has happened so far." },
      { name: "Change", aliases: ["change"], whyItMatters: "Making change is a small algorithm with a real failure case." },
    ],
    hints: [
      "List the situations the machine can be in, and which actions are valid in each one.",
      "Decide who owns the coin float and who decides whether change can be made.",
      "Follow one coin from insertion to either the cash box or the refund tray.",
    ],
  },
  {
    slug: "expense-sharing",
    title: "Expense Sharing",
    difficulty: "medium",
    estimatedMinutes: 40,
    tagline: "Split bills fairly, track who owes whom, settle up.",
    context:
      "Friends on a trip want an app that records shared expenses, works out who owes whom, and suggests the fewest payments to settle up at the end.",
    requirements: [
      { id: "FR-1", text: "Users can create a group and add members to it." },
      { id: "FR-2", text: "A member records an expense with a payer, an amount, and a split: equal, exact amounts, or percentages." },
      { id: "FR-3", text: "The system validates the split: exact amounts must add up to the total and percentages to 100." },
      { id: "FR-4", text: "Each member can see their balance in a group: who owes them and whom they owe." },
      { id: "FR-5", text: "A member can settle up by recording a payment to another member, which updates balances." },
      { id: "FR-6", text: "The group can show a simplified set of payments that settles all debts." },
    ],
    constraints: [
      "Money must be handled without floating-point drift, and rounding remainders (100 split three ways) must go somewhere deterministic.",
      "New ways of splitting are likely to be added.",
      "An expense may be edited or deleted later, and balances must stay correct.",
    ],
    outOfScope: ["Real payment processing", "Authentication", "Notifications"],
    changeScenario: {
      title: "Multi-currency",
      prompt:
        "Groups now travel abroad. Expenses can be recorded in different currencies, and balances are shown in the group's home currency using the exchange rate on the day of the expense.",
    },
    coreConcepts: [
      { name: "Member", aliases: ["user", "member", "person", "friend"], whyItMatters: "Balances are between members." },
      { name: "Group", aliases: ["group", "trip"], whyItMatters: "Groups scope expenses and balances." },
      { name: "Expense", aliases: ["expense", "bill"], whyItMatters: "Expenses are the source of every balance." },
      { name: "Split", aliases: ["split", "share"], whyItMatters: "Split rules vary and need validating." },
      { name: "Balance", aliases: ["balance", "ledger", "owe", "debt"], whyItMatters: "Something must answer 'who owes whom' correctly after edits." },
      { name: "Settlement", aliases: ["settle", "settlement", "payment", "repay"], whyItMatters: "Settling up changes balances without being an expense." },
    ],
    hints: [
      "Ask whether balances should be stored or derived from expenses, and what editing an expense does to each choice.",
      "The split types are a family of rules with the same shape.",
      "Choose a money representation before you write a single method.",
    ],
  },
  {
    slug: "elevator-system",
    title: "Elevator System",
    difficulty: "hard",
    estimatedMinutes: 50,
    tagline: "Dispatch cars to calls without zig-zagging or starving floors.",
    context:
      "A 15-floor office building has three elevator cars. The controller software decides which car answers each call and in what order each car visits its stops.",
    requirements: [
      { id: "FR-1", text: "The building has N floors and M cars; each car has a capacity and moves one floor at a time." },
      { id: "FR-2", text: "A person on a floor presses up or down (a hall call) and the system assigns one car to serve it." },
      { id: "FR-3", text: "Inside a car, a person selects a destination floor (a car call)." },
      { id: "FR-4", text: "A car serves the stops in its current direction before reversing; it does not zig-zag past requested floors." },
      { id: "FR-5", text: "Doors open at a stop and stay closed while moving; an overloaded car does not close its doors." },
      { id: "FR-6", text: "A car can be put into maintenance; it then gets no new hall calls and finishes with the riders already inside." },
    ],
    constraints: [
      "Hall calls arrive concurrently from many floors.",
      "Different buildings want different assignment policies: nearest car, least busy, or zoned for peak hours.",
      "No floor should wait indefinitely while cars serve other floors.",
    ],
    outOfScope: ["Motor control and sensors", "Fire emergency procedures", "Multiple buildings"],
    changeScenario: {
      title: "VIP and express cars",
      prompt:
        "The building adds a VIP mode: a key card makes a car go straight to the selected floor, ignoring other calls. One car is also reserved as an express that serves only floors 1, 10 and 15.",
    },
    coreConcepts: [
      { name: "Elevator car", aliases: ["car", "elevator", "lift", "cabin"], whyItMatters: "Cars hold state: floor, direction, load, stops." },
      { name: "Request", aliases: ["request", "call", "button"], whyItMatters: "Hall calls and car calls are different requests with different sources." },
      { name: "Dispatcher", aliases: ["dispatch", "scheduler", "controller", "assign", "strategy", "policy"], whyItMatters: "The assignment policy varies by building." },
      { name: "Direction", aliases: ["direction", "up", "down"], whyItMatters: "Stop ordering depends on direction of travel." },
      { name: "Door", aliases: ["door"], whyItMatters: "Door rules are where safety constraints live." },
    ],
    hints: [
      "Separate deciding which car answers a call from deciding the order a car visits its stops.",
      "A car's behaviour depends on its state: moving, stopped with doors open, idle, in maintenance.",
      "Think about what is shared between threads, and who is allowed to mutate it.",
    ],
  },
];

export class StaticProblemCatalog implements ProblemCatalog {
  private readonly bySlug: Map<string, Problem>;

  constructor(private readonly problems: Problem[] = PROBLEMS) {
    this.bySlug = new Map(problems.map((p) => [p.slug, p]));
  }

  list(): Problem[] {
    return this.problems;
  }

  find(slug: string): Problem | undefined {
    return this.bySlug.get(slug);
  }
}
