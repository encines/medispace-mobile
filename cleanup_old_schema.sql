-- LIMPIEZA FINAL: Borrar tablas obsoletas y duplicadas no utilizadas
-- Este script borra las tablas del "nuevo esquema" que no se conectaron a la app
-- y las tablas del "viejo esquema" que ya fueron migradas.

-- 1. Borrar tablas del viejo esquema (ya migradas a 'usuarios')
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;

-- 2. Borrar tablas duplicadas en español que NO se están usando en el código TSX
-- (La app sigue usando: appointments, medical_records, offices, branches, ratings)
DROP TABLE IF EXISTS public.expedientes_consultas CASCADE;
DROP TABLE IF EXISTS public.resenas_doctores CASCADE;
DROP TABLE IF EXISTS public.citas CASCADE;
DROP TABLE IF EXISTS public.consultorios_asignados CASCADE;
DROP TABLE IF EXISTS public.consultorios CASCADE;
DROP TABLE IF EXISTS public.propiedades CASCADE;
DROP TABLE IF EXISTS public.metodos_pago_guardados CASCADE;
DROP TABLE IF EXISTS public.registro_actividad CASCADE;

-- 3. Limpiar triggers antiguos
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
