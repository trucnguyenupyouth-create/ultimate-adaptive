-- Migration 004: Add chapter_info column to knowledge_components
ALTER TABLE knowledge_components ADD COLUMN IF NOT EXISTS chapter_info TEXT;
