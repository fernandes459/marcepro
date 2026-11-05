REVOKE EXECUTE ON FUNCTION public.registrar_pagamento_parcial(uuid, numeric, date, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_pagamento_parcial(uuid, numeric, date, text, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO authenticated;