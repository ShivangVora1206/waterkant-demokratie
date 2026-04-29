export async function up(knex) {
  await knex.schema.createTable("images", (table) => {
    table.increments("id").primary();
    table.string("image_uid").notNullable().unique();
    table.string("filename").notNullable();
    table.string("display_name");
    table.string("title");
    table.integer("order_index").notNullable().defaultTo(0);
    table.json("meta");
    table.timestamp("created_at").defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("questions", (table) => {
    table.increments("id").primary();
    table.integer("image_id").notNullable().references("id").inTable("images").onDelete("CASCADE");
    table.text("prompt").notNullable();
    table.integer("order_index").notNullable().defaultTo(0);
    table.string("type").notNullable().defaultTo("text");
    table.boolean("required").notNullable().defaultTo(true);
    table.timestamp("created_at").defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("sessions", (table) => {
    table.increments("id").primary();
    table.string("session_uid").notNullable().unique();
    table.timestamp("started_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("ended_at");
    table.string("device_id");
    table.json("meta");
  });

  await knex.schema.createTable("responses", (table) => {
    table.increments("id").primary();
    table.integer("session_id").notNullable().references("id").inTable("sessions").onDelete("CASCADE");
    table.integer("image_id").notNullable().references("id").inTable("images").onDelete("CASCADE");
    table.integer("question_id").notNullable().references("id").inTable("questions").onDelete("CASCADE");
    table.text("answer").notNullable();
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.unique(["session_id", "question_id"]);
  });

  await knex.schema.createTable("admin_users", (table) => {
    table.increments("id").primary();
    table.string("username").notNullable().unique();
    table.string("password_hash").notNullable();
    table.timestamp("created_at").defaultTo(knex.fn.now());
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("admin_users");
  await knex.schema.dropTableIfExists("responses");
  await knex.schema.dropTableIfExists("sessions");
  await knex.schema.dropTableIfExists("questions");
  await knex.schema.dropTableIfExists("images");
}
