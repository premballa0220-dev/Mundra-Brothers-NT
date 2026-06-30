ALTER TABLE public.payments
ADD COLUMN dispatch_request_id UUID REFERENCES public.dispatch_requests(id) ON DELETE SET NULL;
