CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"password_hash" text NOT NULL,
	"rep_id" text NOT NULL,
	"role" text NOT NULL,
	"password_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
UPDATE "submissions" SET "rep_id" = 'BHrdlichka' WHERE "rep_id" = 'brooke';
