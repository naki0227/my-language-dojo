# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2025_12_18_082521) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "extensions.pg_stat_statements"
  enable_extension "extensions.pgcrypto"
  enable_extension "extensions.uuid-ossp"
  enable_extension "graphql.pg_graphql"
  enable_extension "pg_catalog.plpgsql"
  enable_extension "vault.supabase_vault"

  create_table "achievements", id: :text, force: :cascade do |t|
    t.text "condition_type"
    t.integer "condition_value"
    t.text "description", null: false
    t.text "icon", null: false
    t.text "title", null: false
  end

  create_table "ai_usage_logs", id: :bigint, default: nil, force: :cascade do |t|
    t.integer "count", default: 1
    t.date "date", default: -> { "CURRENT_DATE" }, null: false
    t.text "feature", null: false
    t.uuid "user_id", null: false

    t.unique_constraint ["user_id", "date", "feature"], name: "ai_usage_logs_user_id_date_feature_key"
  end

  create_table "cached_subtitles", id: :bigint, default: nil, force: :cascade do |t|
    t.jsonb "content", null: false
    t.timestamptz "created_at", default: -> { "timezone('utc'::text, now())" }, null: false
    t.text "language", null: false
    t.text "video_id", null: false

    t.unique_constraint ["video_id", "language"], name: "cached_subtitles_video_id_language_key"
  end

  create_table "comments", id: :bigint, default: nil, force: :cascade do |t|
    t.text "content", null: false
    t.timestamptz "created_at", default: -> { "timezone('utc'::text, now())" }, null: false
    t.boolean "is_public", default: true
    t.integer "likes", default: 0
    t.bigint "textbook_id"
    t.uuid "user_id", null: false
    t.text "username", null: false
    t.text "video_id"
  end

  create_table "daily_picks", id: :bigint, default: nil, force: :cascade do |t|
    t.timestamptz "created_at", default: -> { "timezone('utc'::text, now())" }, null: false
    t.date "date", default: -> { "CURRENT_DATE" }
    t.text "message"
    t.jsonb "quiz_data"
    t.text "subject", default: "English"
    t.bigint "textbook_id"
    t.text "video_id"

    t.unique_constraint ["date"], name: "daily_picks_date_key"
  end

  create_table "exercise_questions", id: :bigint, default: nil, force: :cascade do |t|
    t.integer "answer_index"
    t.bigint "exercise_id"
    t.text "explanation"
    t.jsonb "options"
    t.text "question", null: false
  end

  create_table "exercises", id: :bigint, default: nil, force: :cascade do |t|
    t.text "category"
    t.text "level"
    t.text "subject", default: "English"
    t.text "subject_type", default: "Language"
    t.text "title", null: false
  end

  create_table "inquiries", id: :bigint, default: nil, force: :cascade do |t|
    t.text "category"
    t.timestamptz "created_at", default: -> { "timezone('utc'::text, now())" }, null: false
    t.boolean "is_read", default: false
    t.text "message", null: false
    t.text "reply_contact"
    t.text "status", default: "open"
    t.uuid "user_id"
  end

  create_table "library_subtitles", id: :bigint, default: nil, force: :cascade do |t|
    t.float "duration"
    t.float "start_time"
    t.text "text"
    t.uuid "user_id", null: false
    t.text "video_id", null: false
  end

