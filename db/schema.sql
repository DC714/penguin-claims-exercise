create table if not exists members (member_id text primary key, last text, first text, dob date, plan text, eff_dt date);
create table if not exists prior_auths (auth_no text primary key, member_id text, code text, approved date, expires date);
create table if not exists visits (
  enc_id text primary key, source_file text, member_id text, resolve_method text, patient_name text, dos date, provider text,
  note text, minutes int, duplicate_of text, needs_escalation boolean default false, warnings jsonb default '[]');
create table if not exists suggestions (
  id serial primary key, enc_id text references visits(enc_id), source text not null, code text not null, evidence text not null,
  rule text, confidence text, note text, unique (enc_id, source, code));
create table if not exists not_coded (id serial primary key, enc_id text references visits(enc_id), source text not null, code text, evidence text, reason text);
create table if not exists denial_flags (
  id serial primary key, enc_id text references visits(enc_id), source text not null, rule_id text not null, why text, fix text,
  kind text default 'denial', unique (enc_id, source, rule_id, why));
create table if not exists coder_examples (enc_id text primary key, codes text, coder text);
create table if not exists reviews (
  id serial primary key, enc_id text, source text, code text, decision text check (decision in ('accept','reject')),
  reviewer text, at timestamptz default now(), unique (enc_id, source, code, reviewer));
