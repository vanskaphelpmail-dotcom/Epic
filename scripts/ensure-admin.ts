import 'dotenv/config';
import { ensureAdminFromEnv } from '../services/bootstrap-admin';

async function main() {
  const admin = await ensureAdminFromEnv();
  if (!admin) {
    throw new Error('INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD are required');
  }
  console.log(`Admin ready: ${admin.email} (${admin.employeeId})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
