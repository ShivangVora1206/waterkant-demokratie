export async function up(knex) {
  await knex.schema.alterTable("todos", (table) => {
    table.string("category");
    table.string("effort");
    table.string("timeframe");
  });
}

export async function down(knex) {
  await knex.schema.alterTable("todos", (table) => {
    table.dropColumn("timeframe");
    table.dropColumn("effort");
    table.dropColumn("category");
  });
}