// This is the setup.ts file. What this file does is run automatically before the test
// suite starts, so tests use the separate .env.test settings (a test database, a test
// Redis, etc.) instead of accidentally touching real production data.

import dotenv from 'dotenv'; // Bring in the 'dotenv' package, used to load environment variables from a file

dotenv.config({ path: '.env.test' }); // Load the variables from the '.env.test' file into process.env for this test run
