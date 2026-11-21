"""Fill the database with species, the Brussels map and a demo story.

Run it with:  python -m app.seed            (keeps existing data)
              python -m app.seed --reset    (wipes everything first)

The demo story (all six conflicts are real records you can open in the API):
1. House martins above the Mosshaus door  -> negotiated, agreement ACTIVE
2. Bats in the Old Brewery roof            -> negotiation in progress
3. Mason bees on balcony 4B                -> solutions proposed
4. Peregrines vs rooftop solar maintenance -> solutions proposed
5. Night delivery robots vs hedgehogs      -> solutions proposed
6. Fox den next to the playground          -> just reported (run the assessment live!)
"""

import logging
from datetime import timedelta
from typing import Any

from sqlalchemy import delete, inspect, select
from sqlalchemy.orm import Session

from app.core import clock
from app.core.security import hash_password
from app.db.base import Base
from app.models import HumanProfile, MapFeature, Representative, Species, User
from app.seed.brussels_dataset import FEATURES
from app.seed.species_data import DATA_NOTE, SPECIES
from app.services import (
    agreement_service,
    conflict_service,
    llm,
    negotiation_service,
    solution_engine,
)
from app.services.map_service import new_feature

log = logging.getLogger(__name__)

DEMO_PASSWORD = "coexist2126"

SPECIES_COLUMNS = {c.key for c in inspect(Species).mapper.column_attrs}

USERS: list[dict[str, Any]] = [
    {"key": "lina", "email": "lina@example.org", "name": "Lina Okafor", "home": "mosshaus", "unit": "3A",
     "profile": {"age_group": "adult", "household_size": 3, "mobility_needs": ["stroller"], "wildlife_comfort": 4,
                 "priorities": {"safety": 4, "convenience": 4, "cost": 3, "nature": 4, "quiet": 3},
                 "daily_schedule": {"leave_home": "07:45", "return_home": "18:00"}, "bio": "Architect, new parent, secretly loves birds."}},
    {"key": "jonas", "email": "jonas@example.org", "name": "Jonas Verbeke", "home": "brewery", "unit": "owner",
     "profile": {"age_group": "adult", "household_size": 2, "wildlife_comfort": 3, "needs_night_lighting": True, "budget_eur": 2500,
                 "priorities": {"safety": 3, "convenience": 3, "cost": 4, "nature": 3, "quiet": 2}, "bio": "Owns the Old Brewery Lofts. Wants solar roof tiles before winter."}},
    {"key": "mei", "email": "mei@example.org", "name": "Mei Tanaka", "home": "canopy", "unit": "4B",
     "profile": {"age_group": "adult", "household_size": 1, "allergies": ["bee_sting"], "wildlife_comfort": 2,
                 "priorities": {"safety": 5, "convenience": 3, "cost": 3, "nature": 3, "quiet": 4}, "bio": "Illustrator. Works on her balcony every afternoon."}},
    {"key": "rafael", "email": "rafael@example.org", "name": "Rafael Duarte", "home": "solaris", "unit": "staff",
     "profile": {"age_group": "adult", "wildlife_comfort": 3, "budget_eur": 1500,
                 "priorities": {"safety": 4, "convenience": 3, "cost": 3, "nature": 3, "quiet": 2}, "bio": "Solar technician for the Solaris energy co-op."}},
    {"key": "noor", "email": "noor@example.org", "name": "Noor El Idrissi", "home": "pondside", "unit": "12",
     "profile": {"age_group": "adult", "household_size": 4, "wildlife_comfort": 3,
                 "priorities": {"safety": 5, "convenience": 3, "cost": 3, "nature": 3, "quiet": 3}, "bio": "Parent of two very curious kids."}},
    {"key": "ops", "email": "ops@example.org", "name": "GreenLoop Deliveries", "home": "hub", "unit": "ops",
     "profile": {"age_group": "adult", "wildlife_comfort": 3, "budget_eur": 800,
                 "priorities": {"safety": 3, "convenience": 5, "cost": 4, "nature": 3, "quiet": 2}, "bio": "Robot and cargo-bike delivery co-op."}},
    {"key": "admin", "email": "admin@example.org", "name": "Mediator Admin", "home": None, "unit": None, "admin": True,
     "profile": {"wildlife_comfort": 5}},
]


def reset(db: Session) -> None:
    for table in reversed(Base.metadata.sorted_tables):
        db.execute(delete(table))
    db.commit()


def seed_species(db: Session) -> dict[str, Species]:
    existing = {s.slug: s for s in db.scalars(select(Species))}
    for data in SPECIES:
        if data["slug"] in existing:
            rep = existing[data["slug"]].representative
            if rep is not None and rep.phrasebook != data["representative"].get("phrasebook"):
                rep.phrasebook = data["representative"].get("phrasebook") or {}  # keep voices up to date
            continue
        rep_data = data["representative"]
        species = Species(**{k: v for k, v in data.items() if k in SPECIES_COLUMNS}, data_note=DATA_NOTE)
        species.representative = Representative(**rep_data)
        db.add(species)
        existing[data["slug"]] = species
    db.flush()
    return existing


def seed_map(db: Session, species: dict[str, Species]) -> dict[str, MapFeature]:
    by_name = {f.name: f for f in db.scalars(select(MapFeature).where(MapFeature.is_seed.is_(True)))}
    created: dict[str, MapFeature] = {}
    for item in FEATURES:
        if item["name"] in by_name:
            created[item["key"]] = by_name[item["name"]]
            continue
        props = dict(item.get("properties") or {})
        description = props.pop("description", None)
        sp = species.get(item.get("species", ""))
        parent = created.get(item.get("parent", ""))
        feature = new_feature(
            item["layer"], item["name"], item["geometry"], properties=props, description=description,
            species_id=sp.id if sp else None, parent_id=parent.id if parent else None, is_seed=True,
        )
        db.add(feature)
        db.flush()
        created[item["key"]] = feature
        if item["layer"] == "wildlife_site" and sp:
            db.add(conflict_service.buffer_for_site(sp, feature, is_seed=True))
    db.flush()
    return created


def seed_users(db: Session, features: dict[str, MapFeature]) -> dict[str, User]:
    users: dict[str, User] = {}
    for u in USERS:
        user = db.scalars(select(User).where(User.email == u["email"])).first()
        if user is None:
            user = User(email=u["email"], display_name=u["name"], hashed_password=hash_password(DEMO_PASSWORD), is_admin=u.get("admin", False))
            home = features.get(u["home"]) if u.get("home") else None
            user.profile = HumanProfile(home_building_id=home.id if home else None, home_unit=u.get("unit"), **u["profile"])
            db.add(user)
        users[u["key"]] = user
    db.flush()
    return users


def _loc(features: dict[str, MapFeature], key: str) -> dict[str, Any]:
    return features[key].geometry


def seed_story(db: Session, users: dict[str, User], features: dict[str, MapFeature]) -> None:
    from app.models import Conflict

    if db.scalars(select(Conflict)).first() is not None:
        return
    today = clock.today()
    from app.seed.brussels_dataset import pt

    # 1. House martins -> full flow, agreement active.
    c1 = conflict_service.create_conflict(db, users["lina"], {
        "title": "House martins nesting right above the Mosshaus main door",
        "description": "Four mud nests appeared above our main entrance. Droppings land on the doorstep and on my baby's stroller. I don't want to harm them, but we need a clean, usable entrance.",
        "species_slug": "house-martin", "category": "nest_near_entrance", "severity": 3,
        "site_feature_id": features["martin_nest"].id, "location": _loc(features, "moss_main"),
        "human_activity": {"type": "entrance_use", "description": "using the main entrance with a stroller", "daily_hours": ["07:30-09:00", "17:30-19:00"]},
        "observed_on": today - timedelta(days=6),
    })
    solution_engine.assess_conflict(db, c1)
    sols = solution_engine.generate_solutions(db, c1)
    session = negotiation_service.open_session(db, c1)
    negotiation_service.post_comment(db, c1, session, users["lina"], "How long will you stay above our door?")
    screen = next((s for s in sols if s.strategy == "screen_mitigation"), sols[0])
    result = negotiation_service.counter_proposal(db, c1, session, users["lina"], screen.id, {"radius_m": 2}, "Could we keep just 2 metres? The door is narrow.")
    final = result["counter_solution"] or result["revision"]
    accepted = negotiation_service.accept(db, c1, session, users["lina"], final.id)
    agreement = agreement_service.generate(db, c1, accepted)
    agreement_service.sign(db, agreement, users["lina"])

    # 2. Bats vs roof renovation -> negotiation in progress.
    c2 = conflict_service.create_conflict(db, users["jonas"], {
        "title": "Bats living in the Old Brewery roof I'm about to renovate",
        "description": "We booked roofers to install solar tiles this summer. An inspection found a pipistrelle colony under the tiles.",
        "species_slug": "common-pipistrelle", "category": "roost_in_renovation", "severity": 4,
        "site_feature_id": features["bat_roost"].id, "location": pt(-20, -5),
        "human_activity": {"type": "renovation", "description": "roof renovation with solar tiles",
                           "planned_start": (today + timedelta(days=26)).isoformat(), "planned_end": (today + timedelta(days=82)).isoformat(),
                           "flexibility_weeks": 14, "budget_eur": 2500},
    })
    solution_engine.assess_conflict(db, c2)
    solution_engine.generate_solutions(db, c2)
    s2 = negotiation_service.open_session(db, c2)
    negotiation_service.post_comment(db, c2, s2, users["jonas"], "Is it even legal to touch the roof?")

    # 3. Mason bees on a balcony.
    c3 = conflict_service.create_conflict(db, users["mei"], {
        "title": "Solitary bees nesting in my balcony blind (I'm allergic)",
        "description": "Bees fly in and out of the bamboo blind next to my desk. I'm allergic to bee stings and nervous.",
        "species_slug": "red-mason-bee", "category": "pollinators_on_balcony", "severity": 4,
        "site_feature_id": features["bee_nest"].id, "location": pt(122, -4),
        "human_activity": {"type": "space_use", "description": "balcony 4B, used as a workspace every afternoon", "daily_hours": ["13:00-18:00"]},
    })
    solution_engine.assess_conflict(db, c3)
    solution_engine.generate_solutions(db, c3)

    # 4. Peregrines vs rooftop solar maintenance.
    c4 = conflict_service.create_conflict(db, users["rafael"], {
        "title": "Peregrine chicks next to the north solar array",
        "description": "The yearly maintenance of the north solar array is booked, 20 m from the peregrine ledge.",
        "species_slug": "peregrine-falcon", "category": "rooftop_works", "severity": 4,
        "site_feature_id": features["peregrine_nest"].id, "location": _loc(features, "solar_north"),
        "human_activity": {"type": "rooftop_maintenance", "description": "north solar array maintenance",
                           "planned_start": (today + timedelta(days=12)).isoformat(), "planned_end": (today + timedelta(days=16)).isoformat(),
                           "flexibility_weeks": 6, "budget_eur": 1500},
    })
    solution_engine.assess_conflict(db, c4)
    solution_engine.generate_solutions(db, c4)

    # 5. Night robots vs hedgehogs.
    c5 = conflict_service.create_conflict(db, users["ops"], {
        "title": "Night delivery robots crossing the hedgehog highway",
        "description": "Our robots detected small animals crossing Chaussée des Étangs at night. We want to avoid accidents.",
        "species_slug": "european-hedgehog", "category": "movement_vs_mobility", "severity": 3,
        "site_feature_id": features["hedgehog_nest"].id, "location": pt(-77, -60),
        "human_activity": {"type": "deliveries", "description": "night robot deliveries", "daily_hours": ["21:00-06:00"]},
    })
    solution_engine.assess_conflict(db, c5)
    solution_engine.generate_solutions(db, c5)

    # 6. Fox den near the playground -> just reported.
    conflict_service.create_conflict(db, users["noor"], {
        "title": "Fox family living under the shed next to the playground",
        "description": "A vixen and cubs live under the shed. The kids love watching them but parents are worried.",
        "species_slug": "red-fox", "category": "den_near_play_area", "severity": 2,
        "site_feature_id": features["fox_den"].id, "location": _loc(features, "playground"),
        "human_activity": {"type": "space_use", "description": "the Pondside playground", "daily_hours": ["15:30-19:00"]},
    })
    db.flush()


def run(db: Session, *, with_demo: bool = True, do_reset: bool = False) -> dict[str, int]:
    if do_reset:
        reset(db)
    species = seed_species(db)
    features = seed_map(db, species)
    users = seed_users(db, features)
    if with_demo:
        with llm.paused():  # the demo story always uses the templates: fast and repeatable
            seed_story(db, users, features)
    db.commit()
    from app.models import Conflict

    return {
        "species": len(species),
        "map_features": db.query(MapFeature).count(),
        "users": len(users),
        "conflicts": db.query(Conflict).count(),
    }
