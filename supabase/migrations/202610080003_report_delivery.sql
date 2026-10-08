BEGIN;
CREATE TABLE IF NOT EXISTS public.report_delivery_schedules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
 company_code text NOT NULL,
 module text NOT NULL CHECK(module IN ('assets','maintenance')),
 frequency text NOT NULL CHECK(frequency IN ('daily','weekly','monthly')),
 recipients text[] NOT NULL CHECK(cardinality(recipients) BETWEEN 1 AND 20),
 enabled boolean NOT NULL DEFAULT false,
 next_run_at timestamptz NOT NULL DEFAULT now(),
 created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.report_delivery_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 schedule_id uuid NOT NULL REFERENCES public.report_delivery_schedules(id),
 scheduled_for timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','completed','failed')),
 attempts integer NOT NULL DEFAULT 0,
 available_at timestamptz NOT NULL DEFAULT now(),
 claimed_until timestamptz,
 claim_token uuid,
 finished_at timestamptz,
 error_message text,
 UNIQUE(schedule_id,scheduled_for)
);
ALTER TABLE public.report_delivery_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_delivery_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS report_schedule_admin ON public.report_delivery_schedules;
CREATE POLICY report_schedule_admin ON public.report_delivery_schedules FOR ALL TO authenticated
 USING(public.is_admin() AND public.app_has_company(company_code))
 WITH CHECK(public.is_admin() AND public.app_has_company(company_code) AND created_by=auth.uid());
DROP POLICY IF EXISTS report_job_admin ON public.report_delivery_jobs;
CREATE POLICY report_job_admin ON public.report_delivery_jobs FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.report_delivery_schedules s WHERE s.id=schedule_id));
GRANT SELECT,INSERT,UPDATE ON public.report_delivery_schedules TO authenticated;
GRANT SELECT ON public.report_delivery_jobs TO authenticated;
REVOKE ALL ON public.report_delivery_schedules,public.report_delivery_jobs FROM anon;

CREATE OR REPLACE FUNCTION public.claim_report_delivery() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.report_delivery_schedules; j public.report_delivery_jobs; BEGIN
 -- Persist a job and advance its schedule in the same transaction.
 FOR s IN SELECT * FROM public.report_delivery_schedules WHERE enabled AND next_run_at<=now() ORDER BY next_run_at FOR UPDATE SKIP LOCKED LIMIT 20 LOOP
  INSERT INTO public.report_delivery_jobs(schedule_id,scheduled_for) VALUES(s.id,s.next_run_at) ON CONFLICT DO NOTHING;
  UPDATE public.report_delivery_schedules SET next_run_at=now()+CASE s.frequency WHEN 'daily' THEN interval '1 day' WHEN 'weekly' THEN interval '7 days' ELSE interval '1 month' END WHERE id=s.id;
 END LOOP;
 SELECT job.* INTO j FROM public.report_delivery_jobs job
 JOIN public.report_delivery_schedules schedule ON schedule.id=job.schedule_id AND schedule.enabled
 WHERE job.attempts<5 AND ((job.status IN ('pending','failed') AND job.available_at<=now()) OR (job.status='running' AND job.claimed_until<now()))
 ORDER BY job.scheduled_for FOR UPDATE OF job SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO s FROM public.report_delivery_schedules WHERE id=j.schedule_id;
 -- Recheck creator privileges: service credentials must not keep sending after revocation.
 IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=s.created_by AND p.is_active AND
  (p.role='super_admin' OR (p.role='admin' AND EXISTS(SELECT 1 FROM public.user_company_assignments c WHERE c.user_id=p.id AND c.company_code=s.company_code)))) THEN
  UPDATE public.report_delivery_schedules SET enabled=false WHERE id=s.id;
  UPDATE public.report_delivery_jobs SET status='failed',attempts=5,error_message='Schedule owner access was revoked' WHERE id=j.id;
  RETURN NULL;
 END IF;
 UPDATE public.report_delivery_jobs SET status='running',attempts=attempts+1,claimed_until=now()+interval '10 minutes',claim_token=gen_random_uuid()
 WHERE id=j.id RETURNING * INTO j;
 RETURN jsonb_build_object('job',to_jsonb(j),'schedule',to_jsonb(s));
END $$;
CREATE OR REPLACE FUNCTION public.finish_report_delivery(p_id uuid,p_token uuid,p_success boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 UPDATE public.report_delivery_jobs SET status=CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
 finished_at=CASE WHEN p_success THEN now() ELSE NULL END,
 error_message=CASE WHEN p_success THEN NULL ELSE 'Delivery failed. Check worker logs and configuration.' END,
 available_at=now()+interval '15 minutes',claimed_until=NULL
 WHERE id=p_id AND claim_token=p_token AND status='running';
 IF NOT FOUND THEN RAISE EXCEPTION 'Report job lease no longer belongs to this worker'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.claim_report_delivery(),public.finish_report_delivery(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_report_delivery(),public.finish_report_delivery(uuid,uuid,boolean) TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.report_delivery_schedules,public.report_delivery_jobs TO service_role;
COMMIT;
