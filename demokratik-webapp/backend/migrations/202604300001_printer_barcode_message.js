export async function up(knex) {
  await knex.schema.alterTable("printer_settings", (table) => {
    table.string("barcode_message").notNullable().defaultTo("DEMOKRATIE");
  });
}

export async function down(knex) {
  await knex.schema.alterTable("printer_settings", (table) => {
    table.dropColumn("barcode_message");
  });
}