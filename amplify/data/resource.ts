import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

const schema = a.schema({
  Todo: a
    .model({
      content: a.string(),
      isDone: a.boolean(),
      organizationID: a.string(),
      organization: a.belongsTo('Organization', 'organizationID'),
    })
    .authorization(allow => [
      allow.authenticated().to(['read']),
      allow.groups(['Admin']).to(['create', 'read', 'update', 'delete']),
      allow.groups(['Member']).to(['read']),
    ]),

  Organization: a
    .model({
      name: a.string(),
      todos: a.hasMany('Todo', 'organizationID'),
      members: a.hasMany('OrganizationMember', 'organizationID'),
    })
    .authorization(allow => [
      allow.authenticated().to(['read']),
      allow.groups(['Admin']).to(['create', 'read', 'update', 'delete']),
      allow.groups(['Member']).to(['read']),
    ]),

  OrganizationMember: a
    .model({
      organizationID: a.string(),
      userID: a.string(),
      email: a.string(),
      organization: a.belongsTo('Organization', 'organizationID'),
      status: a.enum(['PENDING', 'ACTIVE']),
    })
    .authorization(allow => [
      allow.authenticated().to(['read']),
      allow.groups(['Admin']).to(['create', 'read', 'update', 'delete']),
      allow.groups(['Member']).to(['read']),
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});
