CREATE TABLE "platform_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"passwordHash" varchar(255) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"superState" jsonb NOT NULL,
	"subscriptionPlans" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" varchar(48) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(128) NOT NULL,
	"status" varchar(32) NOT NULL,
	"registeredAt" varchar(32) NOT NULL,
	"mrrRub" integer DEFAULT 0 NOT NULL,
	"generatedMessages30d" integer DEFAULT 0 NOT NULL,
	"generatedRevenue30dRub" bigint DEFAULT 0 NOT NULL,
	"workspace" jsonb NOT NULL,
	"portalPasswordHash" varchar(255),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
