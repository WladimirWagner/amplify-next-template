import { defineAuth } from "@aws-amplify/backend";

/**
 * Define and configure your auth resource
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  userAttributes: {
    // Optional: Definiere zusätzliche Benutzerattribute
  },
  // Definiere die Cognito-Gruppen
  groups: ['Admin', 'Member'],
});
