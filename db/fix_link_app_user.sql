-- 未連携の app_user を、同じメールの Auth ユーザーへ連携（冪等）
update app_user a
set auth_user_id = (
  select u."id" from auth.users u
  where lower(u."email") = lower(a."email")
  limit 1
)
where a.auth_user_id is null;

-- 確認：ログイン中の先生の行が linked = true なら正常
select "email", tenant_id, (auth_user_id is not null) as linked
from app_user
order by "email";
