-- Event Templates (Rodzaje eventów, np. "Mini Event", "Strongest Governor")
CREATE TABLE event_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) CHECK (type IN ('MINI', 'LONG')) NOT NULL, -- MINI (np. 1-2 dni z tym samym punktowaniem) lub LONG (np. 7 dni z różnym punktowaniem)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Point Configuration (Przelicznik punktów na itemy dla danego typu eventu)
CREATE TABLE event_point_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_template_id UUID REFERENCES event_templates(id) ON DELETE CASCADE,
    day_number INTEGER, -- NULL lub 0 dla wszystkich dni, 1..7 dla eventów LONG (konkretny dzień)
    item_name VARCHAR(255) NOT NULL,
    points_required INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Event Instances (Konkretna edycja eventu w danym terminie)
CREATE TABLE event_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_template_id UUID REFERENCES event_templates(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leaderboard Entries (Wyniki graczy dla konkretnej edycji eventu w konkretnym dniu)
CREATE TABLE leaderboard_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_instance_id UUID REFERENCES event_instances(id) ON DELETE CASCADE,
    day_number INTEGER, -- Używane dla wydarzeń LONG, określające dla jakiego dnia jest to topka (ustawiane z dropdownu w UI)
    player_name VARCHAR(255) NOT NULL,
    alliance_tag VARCHAR(50),
    score BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_point_configs_template ON event_point_configs(event_template_id);
CREATE INDEX idx_event_instances_template ON event_instances(event_template_id);
CREATE INDEX idx_leaderboard_instance ON leaderboard_entries(event_instance_id);
CREATE INDEX idx_leaderboard_alliance_tag ON leaderboard_entries(alliance_tag);
