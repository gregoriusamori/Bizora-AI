-- Initial schema for AI Business Intelligence Platform

CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "organization_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "datasets" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "name" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "datasets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dataset_versions" (
    "id" UUID NOT NULL,
    "dataset_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "source_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dataset_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dataset_columns" (
    "id" UUID NOT NULL,
    "dataset_id" UUID NOT NULL,
    "column_name" TEXT NOT NULL,
    "data_type" TEXT NOT NULL,
    "is_nullable" BOOLEAN NOT NULL DEFAULT true,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "dataset_columns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dataset_data" (
    "id" UUID NOT NULL,
    "dataset_id" UUID NOT NULL,
    "row_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dataset_data_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "semantic_models" (
    "id" UUID NOT NULL,
    "dataset_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "semantic_models_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "semantic_mappings" (
    "id" UUID NOT NULL,
    "semantic_model_id" UUID NOT NULL,
    "source_column" TEXT NOT NULL,
    "target_column" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "semantic_mappings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "metric_definitions" (
    "id" UUID NOT NULL,
    "semantic_model_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "expression" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metric_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "dataset_columns_dataset_id_column_name_key" ON "dataset_columns"("dataset_id", "column_name");

CREATE INDEX "datasets_organization_id_idx" ON "datasets"("organization_id");
CREATE INDEX "dataset_versions_dataset_id_idx" ON "dataset_versions"("dataset_id");
CREATE INDEX "dataset_columns_dataset_id_idx" ON "dataset_columns"("dataset_id");
CREATE INDEX "dataset_data_dataset_id_idx" ON "dataset_data"("dataset_id");
CREATE INDEX "semantic_models_dataset_id_idx" ON "semantic_models"("dataset_id");
CREATE INDEX "semantic_mappings_semantic_model_id_idx" ON "semantic_mappings"("semantic_model_id");
CREATE INDEX "metric_definitions_semantic_model_id_idx" ON "metric_definitions"("semantic_model_id");

ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "dataset_versions" ADD CONSTRAINT "dataset_versions_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dataset_columns" ADD CONSTRAINT "dataset_columns_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dataset_data" ADD CONSTRAINT "dataset_data_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "semantic_models" ADD CONSTRAINT "semantic_models_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "semantic_mappings" ADD CONSTRAINT "semantic_mappings_semantic_model_id_fkey" FOREIGN KEY ("semantic_model_id") REFERENCES "semantic_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "metric_definitions" ADD CONSTRAINT "metric_definitions_semantic_model_id_fkey" FOREIGN KEY ("semantic_model_id") REFERENCES "semantic_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;
