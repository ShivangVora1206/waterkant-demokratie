export async function up(knex) {
  await knex.schema.createTable("todos", (table) => {
    table.increments("id").primary();
    table.text("title").notNullable();
    table.text("details");
    table.boolean("is_active").notNullable().defaultTo(true);
    table.timestamp("created_at").defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("session_todos", (table) => {
    table.increments("id").primary();
    table.integer("session_id").notNullable().references("id").inTable("sessions").onDelete("CASCADE");
    table.integer("todo_id").notNullable().references("id").inTable("todos").onDelete("CASCADE");
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.unique(["session_id", "todo_id"]);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("session_todos");
  await knex.schema.dropTableIfExists("todos");
}
