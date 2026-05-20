CREATE TABLE "photos" (
	"id" text PRIMARY KEY NOT NULL,
	"submission_id" text NOT NULL,
	"rep_id" text NOT NULL,
	"school_id" text NOT NULL,
	"blob_url" text NOT NULL,
	"blob_pathname" text NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"taken_at" timestamp with time zone NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "photos_submission_id_idx" ON "photos" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "photos_rep_id_idx" ON "photos" USING btree ("rep_id");--> statement-breakpoint
CREATE INDEX "photos_school_id_idx" ON "photos" USING btree ("school_id");