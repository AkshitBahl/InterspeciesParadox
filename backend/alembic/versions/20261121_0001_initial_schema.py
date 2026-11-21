"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-11-21 11:29:53.545272
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '0001'
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# JSONB on PostgreSQL, plain JSON elsewhere.
JSON_TYPE = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def upgrade() -> None:
    op.create_table('species',
    sa.Column('slug', sa.String(length=64), nullable=False),
    sa.Column('common_name', sa.String(length=120), nullable=False),
    sa.Column('scientific_name', sa.String(length=120), nullable=False),
    sa.Column('taxon_group', sa.String(length=40), nullable=False),
    sa.Column('emoji', sa.String(length=16), nullable=False),
    sa.Column('conservation_status', sa.String(length=8), nullable=False),
    sa.Column('population_trend', sa.String(length=20), nullable=False),
    sa.Column('is_legally_protected', sa.Boolean(), nullable=False),
    sa.Column('legal_protection', sa.Text(), nullable=False),
    sa.Column('active_months', JSON_TYPE, nullable=False),
    sa.Column('sensitive_months', JSON_TYPE, nullable=False),
    sa.Column('sensitive_periods', JSON_TYPE, nullable=False),
    sa.Column('activity_pattern', sa.String(length=20), nullable=False),
    sa.Column('preferred_buffer_m', sa.Double(), nullable=False),
    sa.Column('min_buffer_m', sa.Double(), nullable=False),
    sa.Column('noise_sensitivity', sa.Integer(), nullable=False),
    sa.Column('light_sensitivity', sa.Integer(), nullable=False),
    sa.Column('foraging_range_m', sa.Double(), nullable=False),
    sa.Column('movement_mode', sa.String(length=20), nullable=False),
    sa.Column('diet', JSON_TYPE, nullable=False),
    sa.Column('habitat_requirements', JSON_TYPE, nullable=False),
    sa.Column('ecosystem_services', JSON_TYPE, nullable=False),
    sa.Column('nuisances', JSON_TYPE, nullable=False),
    sa.Column('mitigations', JSON_TYPE, nullable=False),
    sa.Column('facts', JSON_TYPE, nullable=False),
    sa.Column('data_note', sa.Text(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_species'))
    )
    op.create_index(op.f('ix_species_slug'), 'species', ['slug'], unique=True)
    op.create_table('users',
    sa.Column('email', sa.String(length=320), nullable=False),
    sa.Column('hashed_password', sa.String(length=255), nullable=False),
    sa.Column('display_name', sa.String(length=120), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('is_admin', sa.Boolean(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_users'))
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_table('human_profiles',
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('home_building_id', sa.Uuid(), nullable=True),
    sa.Column('home_unit', sa.String(length=40), nullable=True),
    sa.Column('age_group', sa.String(length=20), nullable=True),
    sa.Column('household_size', sa.Integer(), nullable=False),
    sa.Column('mobility_needs', JSON_TYPE, nullable=False),
    sa.Column('allergies', JSON_TYPE, nullable=False),
    sa.Column('pets', JSON_TYPE, nullable=False),
    sa.Column('wildlife_comfort', sa.Integer(), nullable=False),
    sa.Column('noise_tolerance', sa.Integer(), nullable=False),
    sa.Column('needs_night_lighting', sa.Boolean(), nullable=False),
    sa.Column('daily_schedule', JSON_TYPE, nullable=False),
    sa.Column('priorities', JSON_TYPE, nullable=False),
    sa.Column('budget_eur', sa.Integer(), nullable=True),
    sa.Column('preferred_language', sa.String(length=8), nullable=False),
    sa.Column('bio', sa.Text(), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['home_building_id'], ['map_features.id'], name=op.f('fk_human_profiles_home_building_id_map_features'), ondelete='SET NULL', use_alter=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_human_profiles_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_human_profiles'))
    )
    op.create_index(op.f('ix_human_profiles_user_id'), 'human_profiles', ['user_id'], unique=True)
    op.create_table('map_features',
    sa.Column('layer', sa.String(length=40), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('geometry', JSON_TYPE, nullable=False),
    sa.Column('properties', JSON_TYPE, nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('active_months', JSON_TYPE, nullable=True),
    sa.Column('is_seed', sa.Boolean(), nullable=False),
    sa.Column('min_lon', sa.Float(), nullable=False),
    sa.Column('min_lat', sa.Float(), nullable=False),
    sa.Column('max_lon', sa.Float(), nullable=False),
    sa.Column('max_lat', sa.Float(), nullable=False),
    sa.Column('species_id', sa.Uuid(), nullable=True),
    sa.Column('parent_id', sa.Uuid(), nullable=True),
    sa.Column('replaces_feature_id', sa.Uuid(), nullable=True),
    sa.Column('conflict_id', sa.Uuid(), nullable=True),
    sa.Column('solution_id', sa.Uuid(), nullable=True),
    sa.Column('agreement_id', sa.Uuid(), nullable=True),
    sa.Column('created_by_id', sa.Uuid(), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['agreement_id'], ['agreements.id'], name=op.f('fk_map_features_agreement_id_agreements'), ondelete='SET NULL', use_alter=True),
    sa.ForeignKeyConstraint(['conflict_id'], ['conflicts.id'], name=op.f('fk_map_features_conflict_id_conflicts'), ondelete='CASCADE', use_alter=True),
    sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], name=op.f('fk_map_features_created_by_id_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['parent_id'], ['map_features.id'], name=op.f('fk_map_features_parent_id_map_features'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['replaces_feature_id'], ['map_features.id'], name=op.f('fk_map_features_replaces_feature_id_map_features'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['solution_id'], ['solutions.id'], name=op.f('fk_map_features_solution_id_solutions'), ondelete='CASCADE', use_alter=True),
    sa.ForeignKeyConstraint(['species_id'], ['species.id'], name=op.f('fk_map_features_species_id_species'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_map_features'))
    )
    op.create_index(op.f('ix_map_features_agreement_id'), 'map_features', ['agreement_id'], unique=False)
    op.create_index('ix_map_features_bbox', 'map_features', ['min_lon', 'min_lat', 'max_lon', 'max_lat'], unique=False)
    op.create_index(op.f('ix_map_features_conflict_id'), 'map_features', ['conflict_id'], unique=False)
    op.create_index(op.f('ix_map_features_layer'), 'map_features', ['layer'], unique=False)
    op.create_index(op.f('ix_map_features_solution_id'), 'map_features', ['solution_id'], unique=False)
    op.create_index(op.f('ix_map_features_species_id'), 'map_features', ['species_id'], unique=False)
    op.create_index(op.f('ix_map_features_status'), 'map_features', ['status'], unique=False)
    op.create_table('representatives',
    sa.Column('species_id', sa.Uuid(), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('title', sa.String(length=160), nullable=False),
    sa.Column('avatar_emoji', sa.String(length=16), nullable=False),
    sa.Column('personality', sa.Text(), nullable=False),
    sa.Column('tone', sa.String(length=200), nullable=False),
    sa.Column('catchphrases', JSON_TYPE, nullable=False),
    sa.Column('greeting', sa.Text(), nullable=False),
    sa.Column('sign_off', sa.String(length=200), nullable=False),
    sa.Column('phrasebook', JSON_TYPE, nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['species_id'], ['species.id'], name=op.f('fk_representatives_species_id_species'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_representatives')),
    sa.UniqueConstraint('species_id', name=op.f('uq_representatives_species_id'))
    )
    op.create_table('conflicts',
    sa.Column('reporter_id', sa.Uuid(), nullable=False),
    sa.Column('species_id', sa.Uuid(), nullable=False),
    sa.Column('site_feature_id', sa.Uuid(), nullable=True),
    sa.Column('building_feature_id', sa.Uuid(), nullable=True),
    sa.Column('hotspot_feature_id', sa.Uuid(), nullable=True),
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('category', sa.String(length=40), nullable=False),
    sa.Column('status', sa.String(length=30), nullable=False),
    sa.Column('severity', sa.Integer(), nullable=False),
    sa.Column('lon', sa.Double(), nullable=False),
    sa.Column('lat', sa.Double(), nullable=False),
    sa.Column('human_activity', JSON_TYPE, nullable=False),
    sa.Column('observed_on', sa.Date(), nullable=True),
    sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['building_feature_id'], ['map_features.id'], name=op.f('fk_conflicts_building_feature_id_map_features'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['hotspot_feature_id'], ['map_features.id'], name=op.f('fk_conflicts_hotspot_feature_id_map_features'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['reporter_id'], ['users.id'], name=op.f('fk_conflicts_reporter_id_users'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['site_feature_id'], ['map_features.id'], name=op.f('fk_conflicts_site_feature_id_map_features'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['species_id'], ['species.id'], name=op.f('fk_conflicts_species_id_species')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_conflicts'))
    )
    op.create_index(op.f('ix_conflicts_reporter_id'), 'conflicts', ['reporter_id'], unique=False)
    op.create_index(op.f('ix_conflicts_species_id'), 'conflicts', ['species_id'], unique=False)
    op.create_index(op.f('ix_conflicts_status'), 'conflicts', ['status'], unique=False)
    op.create_table('needs_assessments',
    sa.Column('conflict_id', sa.Uuid(), nullable=False),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.Column('assessed_for', sa.Date(), nullable=False),
    sa.Column('human_needs', JSON_TYPE, nullable=False),
    sa.Column('wildlife_needs', JSON_TYPE, nullable=False),
    sa.Column('conflicting_needs', JSON_TYPE, nullable=False),
    sa.Column('compatible_needs', JSON_TYPE, nullable=False),
    sa.Column('constraints', JSON_TYPE, nullable=False),
    sa.Column('co_benefits', JSON_TYPE, nullable=False),
    sa.Column('spatial_context', JSON_TYPE, nullable=False),
    sa.Column('conflict_intensity', sa.Double(), nullable=False),
    sa.Column('summary', sa.Text(), nullable=False),
    sa.Column('representative_statement', JSON_TYPE, nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['conflict_id'], ['conflicts.id'], name=op.f('fk_needs_assessments_conflict_id_conflicts'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_needs_assessments'))
    )
    op.create_index(op.f('ix_needs_assessments_conflict_id'), 'needs_assessments', ['conflict_id'], unique=False)
    op.create_table('solutions',
    sa.Column('conflict_id', sa.Uuid(), nullable=False),
    sa.Column('assessment_id', sa.Uuid(), nullable=True),
    sa.Column('parent_solution_id', sa.Uuid(), nullable=True),
    sa.Column('created_by_id', sa.Uuid(), nullable=True),
    sa.Column('strategy', sa.String(length=40), nullable=False),
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('summary', sa.Text(), nullable=False),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('origin', sa.String(length=30), nullable=False),
    sa.Column('parameters', JSON_TYPE, nullable=False),
    sa.Column('actions', JSON_TYPE, nullable=False),
    sa.Column('need_effects', JSON_TYPE, nullable=False),
    sa.Column('valid_months', JSON_TYPE, nullable=False),
    sa.Column('cost_eur', sa.Integer(), nullable=False),
    sa.Column('effort', sa.String(length=10), nullable=False),
    sa.Column('implementation_days', sa.Integer(), nullable=False),
    sa.Column('legal_compliant', sa.Boolean(), nullable=False),
    sa.Column('legal_notes', JSON_TYPE, nullable=False),
    sa.Column('tradeoffs', JSON_TYPE, nullable=False),
    sa.Column('coexistence_index', sa.Double(), nullable=False),
    sa.Column('index_breakdown', JSON_TYPE, nullable=False),
    sa.Column('representative_comment', JSON_TYPE, nullable=False),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['assessment_id'], ['needs_assessments.id'], name=op.f('fk_solutions_assessment_id_needs_assessments'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['conflict_id'], ['conflicts.id'], name=op.f('fk_solutions_conflict_id_conflicts'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], name=op.f('fk_solutions_created_by_id_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['parent_solution_id'], ['solutions.id'], name=op.f('fk_solutions_parent_solution_id_solutions'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_solutions'))
    )
    op.create_index(op.f('ix_solutions_coexistence_index'), 'solutions', ['coexistence_index'], unique=False)
    op.create_index(op.f('ix_solutions_conflict_id'), 'solutions', ['conflict_id'], unique=False)
    op.create_index(op.f('ix_solutions_status'), 'solutions', ['status'], unique=False)
    op.create_index(op.f('ix_solutions_strategy'), 'solutions', ['strategy'], unique=False)
    op.create_table('agreements',
    sa.Column('conflict_id', sa.Uuid(), nullable=False),
    sa.Column('solution_id', sa.Uuid(), nullable=False),
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('valid_from', sa.Date(), nullable=False),
    sa.Column('valid_until', sa.Date(), nullable=False),
    sa.Column('review_dates', JSON_TYPE, nullable=False),
    sa.Column('parties', JSON_TYPE, nullable=False),
    sa.Column('terms', JSON_TYPE, nullable=False),
    sa.Column('wildlife_expectations', JSON_TYPE, nullable=False),
    sa.Column('monitoring', JSON_TYPE, nullable=False),
    sa.Column('signatures', JSON_TYPE, nullable=False),
    sa.Column('coexistence_index', sa.Double(), nullable=False),
    sa.Column('markdown', sa.Text(), nullable=False),
    sa.Column('terminated_reason', sa.Text(), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['conflict_id'], ['conflicts.id'], name=op.f('fk_agreements_conflict_id_conflicts'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['solution_id'], ['solutions.id'], name=op.f('fk_agreements_solution_id_solutions'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_agreements'))
    )
    op.create_index(op.f('ix_agreements_conflict_id'), 'agreements', ['conflict_id'], unique=False)
    op.create_index(op.f('ix_agreements_status'), 'agreements', ['status'], unique=False)
    op.create_table('negotiation_sessions',
    sa.Column('conflict_id', sa.Uuid(), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('current_solution_id', sa.Uuid(), nullable=True),
    sa.Column('accepted_solution_id', sa.Uuid(), nullable=True),
    sa.Column('rounds', sa.Integer(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['accepted_solution_id'], ['solutions.id'], name=op.f('fk_negotiation_sessions_accepted_solution_id_solutions'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['conflict_id'], ['conflicts.id'], name=op.f('fk_negotiation_sessions_conflict_id_conflicts'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['current_solution_id'], ['solutions.id'], name=op.f('fk_negotiation_sessions_current_solution_id_solutions'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_negotiation_sessions'))
    )
    op.create_index(op.f('ix_negotiation_sessions_conflict_id'), 'negotiation_sessions', ['conflict_id'], unique=True)
    op.create_table('negotiation_messages',
    sa.Column('session_id', sa.Uuid(), nullable=False),
    sa.Column('author_type', sa.String(length=20), nullable=False),
    sa.Column('author_user_id', sa.Uuid(), nullable=True),
    sa.Column('author_name', sa.String(length=120), nullable=False),
    sa.Column('kind', sa.String(length=30), nullable=False),
    sa.Column('text', sa.Text(), nullable=False),
    sa.Column('solution_id', sa.Uuid(), nullable=True),
    sa.Column('payload', JSON_TYPE, nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['author_user_id'], ['users.id'], name=op.f('fk_negotiation_messages_author_user_id_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['session_id'], ['negotiation_sessions.id'], name=op.f('fk_negotiation_messages_session_id_negotiation_sessions'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['solution_id'], ['solutions.id'], name=op.f('fk_negotiation_messages_solution_id_solutions'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_negotiation_messages'))
    )
    op.create_index(op.f('ix_negotiation_messages_session_id'), 'negotiation_messages', ['session_id'], unique=False)

    # Circular foreign keys (map features <-> conflicts/solutions/agreements) are added last.
    op.create_foreign_key("fk_human_profiles_home_building_id_map_features", "human_profiles", "map_features", ["home_building_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_map_features_conflict_id_conflicts", "map_features", "conflicts", ["conflict_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key("fk_map_features_solution_id_solutions", "map_features", "solutions", ["solution_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key("fk_map_features_agreement_id_agreements", "map_features", "agreements", ["agreement_id"], ["id"], ondelete="SET NULL")


def downgrade() -> None:
    # Remove circular foreign keys first.
    op.drop_constraint("fk_human_profiles_home_building_id_map_features", "human_profiles", type_="foreignkey")
    op.drop_constraint("fk_map_features_conflict_id_conflicts", "map_features", type_="foreignkey")
    op.drop_constraint("fk_map_features_solution_id_solutions", "map_features", type_="foreignkey")
    op.drop_constraint("fk_map_features_agreement_id_agreements", "map_features", type_="foreignkey")
    op.drop_index(op.f('ix_negotiation_messages_session_id'), table_name='negotiation_messages')
    op.drop_table('negotiation_messages')
    op.drop_index(op.f('ix_negotiation_sessions_conflict_id'), table_name='negotiation_sessions')
    op.drop_table('negotiation_sessions')
    op.drop_index(op.f('ix_agreements_status'), table_name='agreements')
    op.drop_index(op.f('ix_agreements_conflict_id'), table_name='agreements')
    op.drop_table('agreements')
    op.drop_index(op.f('ix_solutions_strategy'), table_name='solutions')
    op.drop_index(op.f('ix_solutions_status'), table_name='solutions')
    op.drop_index(op.f('ix_solutions_conflict_id'), table_name='solutions')
    op.drop_index(op.f('ix_solutions_coexistence_index'), table_name='solutions')
    op.drop_table('solutions')
    op.drop_index(op.f('ix_needs_assessments_conflict_id'), table_name='needs_assessments')
    op.drop_table('needs_assessments')
    op.drop_index(op.f('ix_conflicts_status'), table_name='conflicts')
    op.drop_index(op.f('ix_conflicts_species_id'), table_name='conflicts')
    op.drop_index(op.f('ix_conflicts_reporter_id'), table_name='conflicts')
    op.drop_table('conflicts')
    op.drop_table('representatives')
    op.drop_index(op.f('ix_map_features_status'), table_name='map_features')
    op.drop_index(op.f('ix_map_features_species_id'), table_name='map_features')
    op.drop_index(op.f('ix_map_features_solution_id'), table_name='map_features')
    op.drop_index(op.f('ix_map_features_layer'), table_name='map_features')
    op.drop_index(op.f('ix_map_features_conflict_id'), table_name='map_features')
    op.drop_index('ix_map_features_bbox', table_name='map_features')
    op.drop_index(op.f('ix_map_features_agreement_id'), table_name='map_features')
    op.drop_table('map_features')
    op.drop_index(op.f('ix_human_profiles_user_id'), table_name='human_profiles')
    op.drop_table('human_profiles')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
    op.drop_index(op.f('ix_species_slug'), table_name='species')
    op.drop_table('species')
