CREATE TABLE "attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"transaction_id" text NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"storage_key" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parties" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'Customer' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"opening" bigint DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"party_id" text NOT NULL,
	"type" text NOT NULL,
	"amount" bigint NOT NULL,
	"date" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachments_transaction_idx" ON "attachments" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "parties_name_idx" ON "parties" USING btree ("name");--> statement-breakpoint
CREATE INDEX "transactions_party_idx" ON "transactions" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "transactions_party_date_idx" ON "transactions" USING btree ("party_id","date");