
Expand the current 2D EVE-style command space sim by adding a functional economy and alternate income systems.

Do NOT rebuild from scratch.
Extend the existing stations, cargo, universe regions, missions, and ship systems.

Main goal:
Create a simple but meaningful economy so the player can earn money through more than combat.
The economy should support:
- trading
- hauling
- regional price differences
- mining sales
- mission rewards
- future expansion into manufacturing or salvage

==================================================
1. ECONOMY GOALS
==================================================

Implement a readable regional economy for the existing universe.

The player should be able to make money through:
- buying low and selling high
- transporting goods between regions/systems
- mining and selling ore
- transport mission rewards
- combat loot sales
- optional salvage sales later

Economy should feel:
- simple enough to understand
- deep enough to matter
- connected to geography
- supportive of different ship roles

==================================================
2. GOODS / COMMODITIES SYSTEM
==================================================

Add a set of trade goods / commodities.

At minimum include categories like:
- food supplies
- industrial parts
- fuel cells
- medical supplies
- electronics
- weapons components
- refined alloys
- frontier survival goods
- luxury goods
- ore / raw minerals

Each commodity should have:
- id
- name
- category
- base price
- volume
- legal/risk tag if used later
- economic tags

==================================================
3. STATION MARKET / INVENTORY MODEL
==================================================

Each station should have market data and inventory tendencies.

A station should be able to:
- sell some goods
- buy some goods
- offer different prices than other stations
- reflect region/system identity

Examples:
- core stations sell common goods and buy luxury/industrial imports
- industrial stations sell parts and buy raw ore
- frontier stations pay more for medicine, fuel, and supplies
- mining systems produce ore cheaply
- military stations buy weapons components

Keep it simple but meaningful.

Each station can have:
- station id
- economy tags
- stock bias / production bias
- demand bias
- buy multipliers
- sell multipliers

==================================================
4. REGIONAL PRICE DIFFERENCES
==================================================

Geography should matter economically.

Prices should vary by:
- region
- system security/risk
- station type
- supply/demand tags

Examples:
- ore cheaper near mining systems, more expensive in high-tech core stations
- medical goods more expensive in isolated frontier systems
- fuel and industrial parts valuable in contested space
- luxury goods mostly profitable in wealthy core systems

Do NOT make the economy random noise.
Make it legible and tied to the map.

==================================================
5. PLAYER TRADING LOOP
==================================================

Implement a basic trading loop.

At stations, the player should be able to:
- browse market goods
- buy goods if they have enough credits and cargo space
- carry goods to another station
- sell goods there for profit or loss

Show clearly:
- buy price
- sell price
- volume
- quantity
- cargo used / remaining
- estimated profit if route data is known or cached

This should make hauling ships and route planning valuable.

==================================================
6. MINING ECONOMY INTEGRATION
==================================================

Connect mining to the economy.

Requirements:
- mined ore should be sellable at stations
- different ore/resource types can have different values
- ore price should vary by region/station type if useful
- mining should become a dependable income path

Optional later:
- ore refining
- refined minerals
- manufacturing inputs

For now:
- prioritize simple ore sale flow

==================================================
7. LOOT / COMBAT INCOME INTEGRATION
==================================================

Connect combat to the economy better.

Requirements:
- combat loot can be sold
- different stations may value loot/salvage differently
- pirate-heavy regions can drop more valuable contraband/components if desired
- combat remains an income path, but not the only one

Optional later:
- black market
- faction requisition
- salvage processing

==================================================
8. MARKET UI
==================================================

Add a clear market/trade UI while docked.

At minimum:
- Buy tab
- Sell tab
- cargo view
- item details
- station market categories
- quantity selector
- total transaction cost/value

UI should clearly show:
- player credits
- cargo capacity used/free
- item volume
- station price
- maybe regional average or reference price if helpful

Optional:
- highlight profitable trade opportunities from known stations
- tooltip showing where demand may be higher

==================================================
9. ECONOMIC INTELLIGENCE / ROUTE SUPPORT
==================================================

Help the player understand where to make money.

Add one or more of these:
- station economy tags in UI
- commodity hints like “high demand in frontier systems”
- recently seen prices at other stations
- trade route suggestions
- simple arbitrage indicators

Important:
Do NOT make this too opaque.
The player should have enough information to make smart choices.

==================================================
10. ALTERNATE INCOME SYSTEMS
==================================================

Ensure the game supports multiple income paths.

At minimum, income should come from:
- combat missions
- transport missions
- trading
- mining
- selling loot

Design each path to support a ship archetype:
- fighters earn from combat and bounties
- haulers earn from trading and transport
- miners earn from extraction and sales
- hybrids can mix mission hauling, light trading, and combat

==================================================
11. BOUNTIES / NPC REWARDS
==================================================

If not already present, optionally improve NPC kill income.

Requirements:
- hostile ships can pay bounties directly on destruction
- tougher enemies pay more
- region danger level can increase bounty values
- this helps combat income feel immediate

Keep it compatible with mission rewards and loot sales.

==================================================
12. ECONOMY DATA MODEL
==================================================

Add clean economy data structures.

Suggested types:
- Commodity
- StationMarketProfile
- MarketListing
- TradeTransaction
- PriceQuote
- EconomicTag

Suggested folders/files:
- src/game/economy
- src/game/economy/data
- src/game/economy/pricing
- src/game/economy/market
- src/game/ui/market
- src/game/types/economy

Commodity fields can include:
- id
- name
- category
- basePrice
- volume
- tags

Station market profile fields can include:
- stationId
- supplyTags
- demandTags
- priceModifiers
- inventoryBias

==================================================
13. PRICE GENERATION LOGIC
==================================================

Implement a clear, explainable price model.

Price can be based on:
- commodity base price
- station supply/demand modifiers
- region modifier
- risk/security modifier
- scarcity tag
- optional small random variation

Keep the formula understandable.
Expose economy constants in config files so they can be tuned later.

==================================================
14. PERSISTENCE
==================================================

Persist:
- player cargo
- owned goods
- current prices if cached
- known station price history if implemented
- credits
- current market inventory if needed

At minimum:
- transactions should survive reload
- cargo and owned goods should persist
- station markets should remain consistent enough to feel like a world

==================================================
15. IMPLEMENTATION ORDER
==================================================

Do this in order:

Phase 1:
- add commodity definitions
- add station market profiles
- implement buy/sell transactions

Phase 2:
- integrate cargo capacity and credits
- integrate mining ore sales and loot sales

Phase 3:
- add regional pricing differences and station identity
- improve market UI

Phase 4:
- add trade guidance / profitability hints
- add bounty polish and alternate income balancing

==================================================
16. IMPORTANT DESIGN CONSTRAINTS
==================================================

Do NOT make the economy needlessly complex.
Do NOT make prices feel random and meaningless.
Do NOT make one income source obviously dominate all others.

The goal is a readable economy that rewards travel, planning, and ship specialization.

==================================================
17. OUTPUT REQUIREMENTS
==================================================

Generate working code, not pseudocode.
At the end explain:
- how prices are calculated
- how stations differ economically
- how commodities are defined
- how player buying/selling works
- how mining and loot tie into the economy
- what files control the market and pricing systems