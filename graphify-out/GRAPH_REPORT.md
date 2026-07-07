# Graph Report - /Users/elw/Documents/Proyectos-Personales/Tap O Meter/Programación/Tap & Pour/KRN_32_ENV/ToM Server  (2026-07-07)

## Corpus Check
- 25 files · ~45,705 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 94 nodes · 91 edges · 23 communities detected
- Extraction: 79% EXTRACTED · 21% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]

## God Nodes (most connected - your core abstractions)
1. `handleMessage()` - 9 edges
2. `Chikilla Craft Brewery` - 9 edges
3. `publish()` - 6 edges
4. `redeemBenefitBeer()` - 4 edges
5. `rewardsFetch()` - 4 edges
6. `handleStatus()` - 4 edges
7. `Express Server Bootstrap with Socket.IO` - 4 edges
8. `Authentication System` - 4 edges
9. `registerSale()` - 3 edges
10. `checkClient()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `Home Page with Beer Display` --references--> `Cloudinary Image Upload Service`  [INFERRED]
  views/index.ejs → README.md
- `REST API Endpoints` --conceptually_related_to--> `Authentication System`  [INFERRED]
  README.md → views/login.ejs, views/signup.ejs, views/profile.ejs
- `Piggybank Icon - Cost/Savings Concept` --conceptually_related_to--> `Chikilla Craft Brewery`  [INFERRED]
  uploads/1590473123097.png → images/1744492968798.jpeg
- `Drink Glass Icon SVG` --conceptually_related_to--> `Chikilla Craft Brewery`  [INFERRED]
  public/drink.svg → images/1744492968798.jpeg
- `Beer Bottle Icon SVG` --conceptually_related_to--> `Chikilla Craft Brewery`  [INFERRED]
  public/beer (2).svg → images/1744492968798.jpeg

## Hyperedges (group relationships)
- **Authentication UI Flow (Login, Signup, Profile)** — login_page, signup_page, profile_page [EXTRACTED 1.00]
- **Real-Time Server Architecture (Socket.IO, Handlers, Integration)** — socket_io_integration, socket_io_handlers, server_bootstrap [EXTRACTED 0.95]
- **Deployment Infrastructure (Docker, MongoDB, Environment)** — docker_deployment, mongodb_integration, environment_variables [EXTRACTED 0.90]
- **Chikilla Craft Beer Product Line** — chikilla_craft_brewery, gose_beer_style, imperial_stout_beer_style [EXTRACTED 1.00]
- **Beer Related Visual Assets** — logo_svg_chikilla_brewery, drink_svg_glass_icon, beer_2_svg_bottle_icon [INFERRED 0.85]

## Communities

### Community 0 - "Community 0"
Cohesion: 0.22
Nodes (8): addLineToList(), handleMessage(), handleStatus(), makeReply(), parseJson(), removeLineFromList(), redeemBenefitBeer(), registerSale()

### Community 1 - "Community 1"
Cohesion: 0.14
Nodes (14): Authentication System, Cloudinary Image Upload Service, Docker Deployment for Raspberry Pi, Environment Variables Configuration, HTTPS/SSL Configuration, Home Page with Beer Display, Login Page, MongoDB Data Persistence (+6 more)

### Community 2 - "Community 2"
Cohesion: 0.17
Nodes (0): 

### Community 3 - "Community 3"
Cohesion: 0.17
Nodes (12): Beer Bottle Icon SVG, Chardonnay Barrel Aged Conditioning, Chikilla Craft Brewery, Drink Glass Icon SVG, Gose Beer Style, Piggybank Icon - Cost/Savings Concept, Nightwars Character - Female Warrior with Beer, Black Helmet Imperial Stout - Chikilla Barrel Aged (+4 more)

### Community 4 - "Community 4"
Cohesion: 0.22
Nodes (6): checkClient(), isAvailable(), rewardsFetch(), forward(), validateClient(), validateWorker()

### Community 5 - "Community 5"
Cohesion: 0.29
Nodes (6): publish(), clearRetainedInfo(), publishDisconnectedLine(), publishEmergencyCard(), publishEvent(), publishToLine()

### Community 6 - "Community 6"
Cohesion: 0.4
Nodes (2): getOrCreateLine(), handleSetup()

### Community 7 - "Community 7"
Cohesion: 0.67
Nodes (0): 

### Community 8 - "Community 8"
Cohesion: 1.0
Nodes (0): 

### Community 9 - "Community 9"
Cohesion: 1.0
Nodes (0): 

### Community 10 - "Community 10"
Cohesion: 1.0
Nodes (0): 

### Community 11 - "Community 11"
Cohesion: 1.0
Nodes (0): 

### Community 12 - "Community 12"
Cohesion: 1.0
Nodes (0): 

### Community 13 - "Community 13"
Cohesion: 1.0
Nodes (0): 

### Community 14 - "Community 14"
Cohesion: 1.0
Nodes (0): 

### Community 15 - "Community 15"
Cohesion: 1.0
Nodes (0): 

### Community 16 - "Community 16"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "Community 17"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "Community 18"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 1.0
Nodes (1): Socket.IO Event Handlers

### Community 21 - "Community 21"
Cohesion: 1.0
Nodes (1): Local JSON Data for Kegs

### Community 22 - "Community 22"
Cohesion: 1.0
Nodes (1): Middle Finger Gesture - Protest/Refusal Icon

## Knowledge Gaps
- **19 isolated node(s):** `Login Page`, `Signup Page`, `Home Page with Beer Display`, `User Profile Page`, `HTTPS/SSL Configuration` (+14 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 8`** (1 nodes): `server.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 9`** (1 nodes): `Client.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 10`** (1 nodes): `Line.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 11`** (1 nodes): `stock.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (1 nodes): `user.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (1 nodes): `beer.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (1 nodes): `worker.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (1 nodes): `sale.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (1 nodes): `keg.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (1 nodes): `barrels.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (1 nodes): `database.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (1 nodes): `index.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (1 nodes): `Socket.IO Event Handlers`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (1 nodes): `Local JSON Data for Kegs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (1 nodes): `Middle Finger Gesture - Protest/Refusal Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `handleMessage()` connect `Community 0` to `Community 4`, `Community 6`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **Why does `validateClient()` connect `Community 4` to `Community 0`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `handleMessage()` (e.g. with `registerSale()` and `validateWorker()`) actually correct?**
  _`handleMessage()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `Chikilla Craft Brewery` (e.g. with `Nightwars Character - Female Warrior with Beer` and `Piggybank Icon - Cost/Savings Concept`) actually correct?**
  _`Chikilla Craft Brewery` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `publish()` (e.g. with `redeemBenefitBeer()` and `publishToLine()`) actually correct?**
  _`publish()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `redeemBenefitBeer()` (e.g. with `publish()` and `handleMessage()`) actually correct?**
  _`redeemBenefitBeer()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Login Page`, `Signup Page`, `Home Page with Beer Display` to the rest of the system?**
  _19 weakly-connected nodes found - possible documentation gaps or missing edges._