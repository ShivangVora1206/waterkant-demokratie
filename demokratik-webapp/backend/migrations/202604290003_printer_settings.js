export async function up(knex) {
  await knex.schema.createTable("printer_settings", (table) => {
    table.integer("id").primary();
    table.boolean("enabled").notNullable().defaultTo(false);
    table.string("host");
    table.integer("port").notNullable().defaultTo(9100);
    table.integer("paper_width").notNullable().defaultTo(42);
    table.boolean("cut_paper").notNullable().defaultTo(true);
    table.string("receipt_title").notNullable().defaultTo("Suggested Todos");
    table.string("footer_text").notNullable().defaultTo("Thank you");
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
  });

  await knex("printer_settings").insert({ id: 1 });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("printer_settings");
}