create table datasets (
 id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
 owner text not null, purpose text not null, personal boolean not null default false,
 review_due date not null, max_age_hours integer not null default 24 check(max_age_hours>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index datasets_code_ci on datasets(lower(code));
create table rules (
 id uuid primary key default gen_random_uuid(), dataset_id uuid not null references datasets,
 code text not null unique, name text not null, kind text not null check(kind in ('row_count','missing','duplicate','number_range','allowed','freshness')),
 field text, lower_bound numeric, upper_bound numeric, allowed jsonb,
 max_failures integer not null default 0 check(max_failures>=0), severity integer not null check(severity between 1 and 3), enabled boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(lower_bound is null or upper_bound is null or lower_bound<=upper_bound),
 check(kind='row_count' or (field is not null and length(trim(field))>0)),
 check(kind not in ('row_count','number_range') or lower_bound is not null or upper_bound is not null),
 check(kind!='freshness' or (upper_bound is not null and upper_bound>0)),
 check(kind!='allowed' or (allowed is not null and jsonb_typeof(allowed)='array' and jsonb_array_length(allowed)>0))
);
create unique index rules_code_ci on rules(lower(code));
create table batches (
 id uuid primary key default gen_random_uuid(), dataset_id uuid not null references datasets, source_name text not null,
 sha256 text not null, row_count integer not null check(row_count>=0), actor text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table results (
 id uuid primary key default gen_random_uuid(), dataset_id uuid not null references datasets,
 rule_id uuid references rules, batch_id uuid references batches, check_name text not null,
 origin text not null check(origin in ('local','dqops')), measured_at timestamptz not null,
 actual_value numeric, failed_rows integer check(failed_rows>=0), severity integer not null check(severity between 0 and 4),
 rule_snapshot jsonb, source_key text unique, source_hash text, source_row jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(origin!='local' or (rule_id is not null and batch_id is not null and rule_snapshot is not null))
);
create index results_dataset on results(dataset_id,measured_at desc);
create table actions (
 id uuid primary key default gen_random_uuid(), code text not null unique, dataset_id uuid not null references datasets,
 name text not null, owner text not null, due date not null, status text not null default 'open' check(status in ('open','closed')),
 evidence text, closed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(status!='closed' or (length(trim(evidence))>0 and closed_at is not null))
);
create unique index actions_code_ci on actions(lower(code));
create table use_reviews (
 id uuid primary key default gen_random_uuid(), dataset_id uuid not null references datasets, batch_id uuid not null references batches,
 reviewer text not null, purpose text not null, evidence text not null, expires_at timestamptz not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table events (
 id uuid primary key default gen_random_uuid(), subject_id uuid not null, actor text not null, action text not null, detail jsonb not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table imports (
 id uuid primary key default gen_random_uuid(), dataset_id uuid not null references datasets, source text not null,
 sha256 text not null, added integer not null, skipped integer not null, actor text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create function touch_updated() returns trigger language plpgsql as $$ begin new.updated_at=now();return new;end $$;
do $$ declare t text; begin foreach t in array array['datasets','rules','batches','results','actions','use_reviews','events','imports'] loop
 execute format('create trigger touch_updated before update on %I for each row execute function touch_updated()',t);
 execute format('alter table %I enable row level security',t);
 execute format('revoke all on %I from public',t);
 end loop;end $$;
create view v_latest_batch with(security_invoker=true) as
 select distinct on(dataset_id) * from batches order by dataset_id,created_at desc,id desc;
create view v_checks with(security_invoker=true) as
 select d.code as dataset,r.code as rule,r.kind,r.enabled,x.severity,x.failed_rows,b.created_at as checked_at
 from rules r join datasets d on d.id=r.dataset_id
 left join v_latest_batch b on b.dataset_id=d.id
 left join results x on x.batch_id=b.id and x.rule_id=r.id;
create view v_compliance with(security_invoker=true) as
 select d.id as dataset_id,d.code as dataset,'OWNER'::text as rule,'Assign a dataset owner'::text as finding from datasets d where trim(d.owner)=''
 union all select id,code,'PURPOSE','Record why these records are used' from datasets where trim(purpose)=''
 union all select id,code,'REVIEW_DUE','Dataset governance review is overdue' from datasets where review_due<current_date
 union all select d.id,d.code,'NO_RULES','No active quality rules' from datasets d where not exists(select 1 from rules r where r.dataset_id=d.id and r.enabled)
 union all select d.id,d.code,'STALE_CHECK','No recent local check of the business data' from datasets d left join v_latest_batch b on b.dataset_id=d.id where b.id is null or b.created_at<now()-make_interval(hours=>d.max_age_hours)
 union all select d.id,d.code,'FAILED_CHECK',r.code||' did not pass the latest check' from datasets d join v_latest_batch b on b.dataset_id=d.id join results x on x.batch_id=b.id join rules r on r.id=x.rule_id where r.enabled and x.severity>0
 union all select d.id,d.code,'RULE_CHANGED',r.code||' needs a fresh run' from datasets d join rules r on r.dataset_id=d.id and r.enabled left join v_latest_batch b on b.dataset_id=d.id where not exists(select 1 from results x where x.batch_id=b.id and x.rule_id=r.id and x.rule_snapshot=to_jsonb(r))
 union all select d.id,d.code,'OPEN_ACTION',a.code||': '||a.name from datasets d join actions a on a.dataset_id=d.id where a.status='open';
create view v_attention with(security_invoker=true) as
 select dataset,rule as kind,finding as detail from v_compliance
 union all select d.code,'USE_REVIEW','Personal data has no current use-review evidence for the latest batch' from datasets d left join v_latest_batch b on b.dataset_id=d.id where d.personal and not exists(select 1 from use_reviews u where u.dataset_id=d.id and u.batch_id=b.id and u.purpose=d.purpose and u.expires_at>now())
 union all select d.code,'ACTION_OVERDUE',a.code||': '||a.name from actions a join datasets d on d.id=a.dataset_id where a.status='open' and a.due<current_date;
create view v_week with(security_invoker=true) as
 select d.code,d.name,d.owner,d.personal,d.review_due,b.row_count,b.created_at as last_checked,
 (select count(*) from v_compliance c where c.dataset_id=d.id) as blockers,
 (select count(*) from actions a where a.dataset_id=d.id and a.status='open') as open_actions from datasets d left join v_latest_batch b on b.dataset_id=d.id;
