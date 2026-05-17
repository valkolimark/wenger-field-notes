CREATE TABLE "submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"school_name" text NOT NULL,
	"rep_id" text NOT NULL,
	"rep_name" text NOT NULL,
	"visit_date" timestamp with time zone NOT NULL,
	"priority" jsonb NOT NULL,
	"contact" jsonb NOT NULL,
	"purchasing" jsonb NOT NULL,
	"decision_making" jsonb NOT NULL,
	"marketing" jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "submissions_rep_id_idx" ON "submissions" USING btree ("rep_id");--> statement-breakpoint
CREATE INDEX "submissions_school_id_idx" ON "submissions" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "submissions_visit_date_idx" ON "submissions" USING btree ("visit_date");