-- Revelation corpus schema (SurrealDB v3)
-- Apply with: surreal import --conn http://localhost:8000 --user root --pass root \
--                 --ns revelation --db main surreal/schema.surql

-- ──────────────────────────────────────────────────────────────────────────────
-- Analyzers (full-text)
-- ──────────────────────────────────────────────────────────────────────────────
DEFINE ANALYZER OVERWRITE french
  TOKENIZERS class
  FILTERS lowercase, ascii, snowball(french);

DEFINE ANALYZER OVERWRITE english
  TOKENIZERS class
  FILTERS lowercase, ascii, snowball(english);

-- ──────────────────────────────────────────────────────────────────────────────
-- Bible structure
-- ──────────────────────────────────────────────────────────────────────────────
DEFINE TABLE OVERWRITE bible_book SCHEMAFULL;
DEFINE FIELD OVERWRITE name_fr ON bible_book TYPE string;
DEFINE FIELD OVERWRITE name_en ON bible_book TYPE string;
DEFINE FIELD OVERWRITE canon_order ON bible_book TYPE int;
DEFINE FIELD OVERWRITE testament ON bible_book TYPE "OT" | "NT";
DEFINE INDEX OVERWRITE bible_book_name_fr ON bible_book FIELDS name_fr UNIQUE;
DEFINE INDEX OVERWRITE bible_book_canon_order ON bible_book FIELDS canon_order UNIQUE;

DEFINE TABLE OVERWRITE bible_ref SCHEMAFULL;
DEFINE FIELD OVERWRITE book ON bible_ref TYPE record<bible_book>;
DEFINE FIELD OVERWRITE chapter ON bible_ref TYPE int;
DEFINE FIELD OVERWRITE verse_start ON bible_ref TYPE option<int>;
DEFINE FIELD OVERWRITE verse_end ON bible_ref TYPE option<int>;
DEFINE FIELD OVERWRITE canonical ON bible_ref TYPE string;          -- e.g. "Matthieu 24:6", "Matthieu 24:5-7"
DEFINE FIELD OVERWRITE strong ON bible_ref TYPE option<array<string>>;  -- Strong's H/G numbers
DEFINE FIELD OVERWRITE text ON bible_ref TYPE option<object> FLEXIBLE;       -- {lsg, darby, ost, kjv} — FLEXIBLE allows arbitrary nested keys
DEFINE INDEX OVERWRITE bible_ref_canonical ON bible_ref FIELDS canonical UNIQUE;
DEFINE INDEX OVERWRITE bible_ref_book_chapter ON bible_ref FIELDS book, chapter;

-- One Louis Segond verse per record, id bible_verse:[canon_order, chapter, verse].
-- The editorial pass (goal 10) quotes a reading verse by verse from here.
DEFINE TABLE OVERWRITE bible_verse SCHEMAFULL;
DEFINE FIELD OVERWRITE lsg ON bible_verse TYPE string;

-- ──────────────────────────────────────────────────────────────────────────────
-- Entities
-- ──────────────────────────────────────────────────────────────────────────────
DEFINE TABLE OVERWRITE person SCHEMAFULL;
DEFINE FIELD OVERWRITE name ON person TYPE string;
DEFINE FIELD OVERWRITE aliases ON person TYPE array<string> DEFAULT [];
DEFINE FIELD OVERWRITE kind ON person TYPE
  "biblical" | "historical" | "preacher" | "author" | "modern_other";
DEFINE INDEX OVERWRITE person_name ON person FIELDS name UNIQUE;

DEFINE TABLE OVERWRITE place SCHEMAFULL;
DEFINE FIELD OVERWRITE name ON place TYPE string;
DEFINE FIELD OVERWRITE kind ON place TYPE "biblical" | "modern" | "region";
DEFINE FIELD OVERWRITE coords ON place TYPE option<array<float, 2>>;
DEFINE INDEX OVERWRITE place_name ON place FIELDS name UNIQUE;

DEFINE TABLE OVERWRITE theme SCHEMAFULL;
DEFINE FIELD OVERWRITE name ON theme TYPE string;
DEFINE FIELD OVERWRITE parent ON theme TYPE option<record<theme>>;
DEFINE INDEX OVERWRITE theme_name ON theme FIELDS name UNIQUE;

DEFINE TABLE OVERWRITE tag SCHEMAFULL;
DEFINE FIELD OVERWRITE name ON tag TYPE string;
DEFINE INDEX OVERWRITE tag_name ON tag FIELDS name UNIQUE;

-- ──────────────────────────────────────────────────────────────────────────────
-- Works (unified content table)
-- ──────────────────────────────────────────────────────────────────────────────
DEFINE TABLE OVERWRITE work SCHEMAFULL;

DEFINE FIELD OVERWRITE kind ON work TYPE
  "sermon" | "exhortation" | "bible_study" | "book"
  | "chapter" | "article" | "testimony" | "communique";

DEFINE FIELD OVERWRITE source ON work TYPE
  "branham" | "mevar" | "le-scribe" | "mevar-pdfs" | "onedrive" | "cmpp" | "local";
DEFINE FIELD OVERWRITE source_id ON work TYPE string;       -- original sermon_id from manifest
DEFINE FIELD OVERWRITE source_url ON work TYPE option<string>;
DEFINE FIELD OVERWRITE pdf_url ON work TYPE option<string>;
DEFINE FIELD OVERWRITE audio_url ON work TYPE option<string>;
DEFINE FIELD OVERWRITE local_md ON work TYPE string;
DEFINE FIELD OVERWRITE local_image ON work TYPE option<string>;

DEFINE FIELD OVERWRITE lang ON work TYPE "fr" | "en";
DEFINE FIELD OVERWRITE title ON work TYPE string;
DEFINE FIELD OVERWRITE subtitle ON work TYPE option<string>;
DEFINE FIELD OVERWRITE slug ON work TYPE string;
DEFINE FIELD OVERWRITE summary ON work TYPE option<string>;
DEFINE FIELD OVERWRITE body ON work TYPE string;

DEFINE FIELD OVERWRITE date ON work TYPE option<datetime>;
DEFINE FIELD OVERWRITE year ON work TYPE option<int>;
DEFINE FIELD OVERWRITE duration_min ON work TYPE option<int>;

DEFINE FIELD OVERWRITE size_bytes ON work TYPE option<int>;
DEFINE FIELD OVERWRITE line_count ON work TYPE option<int>;
DEFINE FIELD OVERWRITE llm_cleaned ON work TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE created_at ON work TYPE datetime DEFAULT time::now();

-- sha256 of body — stable across re-ingests, used to look up cached embeddings
DEFINE FIELD OVERWRITE content_hash ON work TYPE option<string>;
DEFINE INDEX OVERWRITE work_content_hash ON work FIELDS content_hash;

-- Denormalized vector embedding copy (the source of truth lives in embedding_cache).
-- Dimension is open-ended — set per-model when populated by scripts/140-embed.mjs.
DEFINE FIELD OVERWRITE embedding ON work TYPE option<array<float>>;
DEFINE FIELD OVERWRITE embedding_model ON work TYPE option<string>;

-- ──────────────────────────────────────────────────────────────────────────────
-- Embedding cache (content-hash keyed; survives work-id changes)
-- ──────────────────────────────────────────────────────────────────────────────
DEFINE TABLE OVERWRITE embedding_cache SCHEMAFULL;
DEFINE FIELD OVERWRITE content_hash ON embedding_cache TYPE string;
DEFINE FIELD OVERWRITE model ON embedding_cache TYPE string;
DEFINE FIELD OVERWRITE dim ON embedding_cache TYPE int;
DEFINE FIELD OVERWRITE vector ON embedding_cache TYPE array<float>;
DEFINE FIELD OVERWRITE source_hint ON embedding_cache TYPE option<string>;   -- for human inspection only
DEFINE FIELD OVERWRITE title_hint ON embedding_cache TYPE option<string>;
DEFINE FIELD OVERWRITE created_at ON embedding_cache TYPE datetime DEFAULT time::now();
DEFINE INDEX OVERWRITE embedding_cache_hash_model ON embedding_cache FIELDS content_hash, model UNIQUE;

-- Indexes for work
DEFINE INDEX OVERWRITE work_source_id ON work FIELDS source, source_id UNIQUE;
DEFINE INDEX OVERWRITE work_kind ON work FIELDS kind;
DEFINE INDEX OVERWRITE work_year ON work FIELDS year;
DEFINE INDEX OVERWRITE work_slug ON work FIELDS slug;
DEFINE INDEX OVERWRITE work_body_fr ON work FIELDS body FULLTEXT ANALYZER french BM25 HIGHLIGHTS;
-- Vector index (uncomment after first embedding pass)
-- DEFINE INDEX work_embedding ON work FIELDS embedding HNSW DIMENSION 1024 TYPE F32 DIST COSINE EFC 200 M 16;

-- ──────────────────────────────────────────────────────────────────────────────
-- Edges
-- ──────────────────────────────────────────────────────────────────────────────
DEFINE TABLE OVERWRITE by TYPE RELATION FROM work TO person;
DEFINE FIELD OVERWRITE role ON by TYPE
  "preacher" | "author" | "co-author" | "transcriber" | "translator" | "editor";
DEFINE INDEX OVERWRITE by_in_out_role ON by COLUMNS in, out, role UNIQUE;

DEFINE TABLE OVERWRITE contains TYPE RELATION FROM work TO work;
DEFINE FIELD OVERWRITE position ON contains TYPE option<int>;
DEFINE INDEX OVERWRITE contains_in_out ON contains COLUMNS in, out UNIQUE;

DEFINE TABLE OVERWRITE based_on TYPE RELATION FROM work TO work;
DEFINE FIELD OVERWRITE similarity ON based_on TYPE option<float>;
DEFINE INDEX OVERWRITE based_on_in_out ON based_on COLUMNS in, out UNIQUE;

DEFINE TABLE OVERWRITE followed_by TYPE RELATION FROM work TO work;
DEFINE INDEX OVERWRITE followed_by_in_out ON followed_by COLUMNS in, out UNIQUE;

DEFINE TABLE OVERWRITE cites TYPE RELATION FROM work TO bible_ref;
DEFINE FIELD OVERWRITE context ON cites TYPE option<string>;
DEFINE INDEX OVERWRITE cites_in_out ON cites COLUMNS in, out UNIQUE;

DEFINE TABLE OVERWRITE mentions TYPE RELATION FROM work TO person;
DEFINE INDEX OVERWRITE mentions_in_out ON mentions COLUMNS in, out UNIQUE;

DEFINE TABLE OVERWRITE mentions_place TYPE RELATION FROM work TO place;
DEFINE INDEX OVERWRITE mentions_place_in_out ON mentions_place COLUMNS in, out UNIQUE;

DEFINE TABLE OVERWRITE has_theme TYPE RELATION FROM work TO theme;
DEFINE INDEX OVERWRITE has_theme_in_out ON has_theme COLUMNS in, out UNIQUE;

DEFINE TABLE OVERWRITE has_tag TYPE RELATION FROM work TO tag;
DEFINE INDEX OVERWRITE has_tag_in_out ON has_tag COLUMNS in, out UNIQUE;

-- ──────────────────────────────────────────────────────────────────────────────
-- Users (Logto-issued JWTs populate these via DEFINE ACCESS user TYPE JWT)
-- ──────────────────────────────────────────────────────────────────────────────
DEFINE TABLE OVERWRITE user SCHEMAFULL
  PERMISSIONS
    FOR select WHERE id = $auth.id OR "admin" IN $token.roles
    FOR update WHERE id = $auth.id;
DEFINE FIELD OVERWRITE email ON user TYPE option<string>;
DEFINE FIELD OVERWRITE name ON user TYPE option<string>;
DEFINE FIELD OVERWRITE created_at ON user TYPE datetime DEFAULT time::now() READONLY;

DEFINE TABLE OVERWRITE bookmarked TYPE RELATION FROM user TO work
  PERMISSIONS FOR select, create, delete WHERE in = $auth.id;
DEFINE INDEX OVERWRITE bookmarked_in_out ON bookmarked COLUMNS in, out UNIQUE;

DEFINE TABLE OVERWRITE completed TYPE RELATION FROM user TO work
  PERMISSIONS FOR select, create, update, delete WHERE in = $auth.id;
DEFINE FIELD OVERWRITE progress ON completed TYPE float DEFAULT 0.0;
DEFINE FIELD OVERWRITE completed_at ON completed TYPE option<datetime>;
DEFINE INDEX OVERWRITE completed_in_out ON completed COLUMNS in, out UNIQUE;

DEFINE TABLE OVERWRITE annotated TYPE RELATION FROM user TO work
  PERMISSIONS FOR select, create, update, delete WHERE in = $auth.id;
DEFINE FIELD OVERWRITE note ON annotated TYPE string;
DEFINE FIELD OVERWRITE anchor ON annotated TYPE option<string>;
DEFINE FIELD OVERWRITE updated_at ON annotated TYPE datetime DEFAULT time::now();
