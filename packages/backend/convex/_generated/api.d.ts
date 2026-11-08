/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as ads from "../ads.js";
import type * as auth from "../auth.js";
import type * as authEmail from "../authEmail.js";
import type * as authPolicy from "../authPolicy.js";
import type * as charges from "../charges.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as developmentAuth from "../developmentAuth.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as imports from "../imports.js";
import type * as learners from "../learners.js";
import type * as lib_audiences from "../lib/audiences.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_dashboardAggregate from "../lib/dashboardAggregate.js";
import type * as lib_dashboardState from "../lib/dashboardState.js";
import type * as lib_fileRules from "../lib/fileRules.js";
import type * as lib_fileValidators from "../lib/fileValidators.js";
import type * as lib_functions from "../lib/functions.js";
import type * as lib_notificationQueue from "../lib/notificationQueue.js";
import type * as lib_notificationRules from "../lib/notificationRules.js";
import type * as lib_read from "../lib/read.js";
import type * as lib_receiptPdf from "../lib/receiptPdf.js";
import type * as lib_workflowRules from "../lib/workflowRules.js";
import type * as notices from "../notices.js";
import type * as notificationEmail from "../notificationEmail.js";
import type * as notificationJobs from "../notificationJobs.js";
import type * as notifications from "../notifications.js";
import type * as onboarding from "../onboarding.js";
import type * as receiptAssets from "../receiptAssets.js";
import type * as receiptFiles from "../receiptFiles.js";
import type * as resources from "../resources.js";
import type * as schoolData from "../schoolData.js";
import type * as schoolRead from "../schoolRead.js";
import type * as seed from "../seed.js";
import type * as seedFiles from "../seedFiles.js";
import type * as seedSupport from "../seedSupport.js";
import type * as users from "../users.js";
import type * as validators from "../validators.js";
import type * as workflowForms from "../workflowForms.js";
import type * as workflows from "../workflows.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  ads: typeof ads;
  auth: typeof auth;
  authEmail: typeof authEmail;
  authPolicy: typeof authPolicy;
  charges: typeof charges;
  crons: typeof crons;
  dashboard: typeof dashboard;
  developmentAuth: typeof developmentAuth;
  files: typeof files;
  http: typeof http;
  imports: typeof imports;
  learners: typeof learners;
  "lib/audiences": typeof lib_audiences;
  "lib/audit": typeof lib_audit;
  "lib/auth": typeof lib_auth;
  "lib/dashboardAggregate": typeof lib_dashboardAggregate;
  "lib/dashboardState": typeof lib_dashboardState;
  "lib/fileRules": typeof lib_fileRules;
  "lib/fileValidators": typeof lib_fileValidators;
  "lib/functions": typeof lib_functions;
  "lib/notificationQueue": typeof lib_notificationQueue;
  "lib/notificationRules": typeof lib_notificationRules;
  "lib/read": typeof lib_read;
  "lib/receiptPdf": typeof lib_receiptPdf;
  "lib/workflowRules": typeof lib_workflowRules;
  notices: typeof notices;
  notificationEmail: typeof notificationEmail;
  notificationJobs: typeof notificationJobs;
  notifications: typeof notifications;
  onboarding: typeof onboarding;
  receiptAssets: typeof receiptAssets;
  receiptFiles: typeof receiptFiles;
  resources: typeof resources;
  schoolData: typeof schoolData;
  schoolRead: typeof schoolRead;
  seed: typeof seed;
  seedFiles: typeof seedFiles;
  seedSupport: typeof seedSupport;
  users: typeof users;
  validators: typeof validators;
  workflowForms: typeof workflowForms;
  workflows: typeof workflows;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  notificationRateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"notificationRateLimiter">;
  notificationEmailWorkpool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"notificationEmailWorkpool">;
  notificationWorkpool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"notificationWorkpool">;
  dashboardAggregate: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"dashboardAggregate">;
};
