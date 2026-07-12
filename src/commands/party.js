const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const {
  createParty,
  getAllParties,
  rekeyParty,
} = require("../handlers/partyManager");
const { buildPartyEmbed, buildPartyButtons } = require("../handlers/uiBuilders");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("party")
    .setDescription("Organize an MMORPG party or raid group")
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Start a new party listing")
        .addStringOption((opt) =>
          opt
            .setName("activity")
            .setDescription("What you're doing, e.g. 'Molten Core Raid'")
            .setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("tanks")
            .setDescription("Tank slots needed (default: 1)")
            .setMinValue(0)
            .setMaxValue(10)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("healers")
            .setDescription("Healer slots needed (default: 1)")
            .setMinValue(0)
            .setMaxValue(10)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("swordmasters")
            .setDescription("Swordmaster (SM) slots needed (default: 1)")
            .setMinValue(0)
            .setMaxValue(10)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("mercenaries")
            .setDescription("Mercenary (Merc) slots needed (default: 1)")
            .setMinValue(0)
            .setMaxValue(10)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("sorceresses")
            .setDescription("Sorceress slots needed (default: 1)")
            .setMinValue(0)
            .setMaxValue(10)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("flexible")
            .setDescription("Flexible (DPS) slots needed (default: 3)")
            .setMinValue(0)
            .setMaxValue(20)
        )
        .addStringOption((opt) =>
          opt.setName("time").setDescription("When you're running it, e.g. 'Tonight 8pm EST'")
        )
        .addStringOption((opt) =>
          opt.setName("note").setDescription("Any extra info, e.g. min item level")
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("Show all active parties on this server")
    )
    .addSubcommand((sub) =>
      sub
        .setName("recall")
        .setDescription("Repost a party's listing so it's not buried in chat")
        .addStringOption((opt) =>
          opt
            .setName("activity")
            .setDescription("Which party to recall (only needed if more than one is active)")
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "create") {
      const activity = interaction.options.getString("activity");
      const time = interaction.options.getString("time");
      const note = interaction.options.getString("note");
      const roleCaps = {
        tank: interaction.options.getInteger("tanks") ?? 1,
        healer: interaction.options.getInteger("healers") ?? 1,
        swordmaster: interaction.options.getInteger("swordmasters") ?? 1,
        mercenary: interaction.options.getInteger("mercenaries") ?? 1,
        sorceress: interaction.options.getInteger("sorceresses") ?? 1,
        flexible: interaction.options.getInteger("flexible") ?? 3,
      };

      if (Object.values(roleCaps).every((c) => c === 0)) {
        return interaction.reply({
          content:
            "You need at least one open role slot (tanks, healers, swordmasters, mercenaries, sorceresses, or flexible) to create a party.",
          flags: MessageFlags.Ephemeral,
        });
      }

      // Reply first to get a message we can attach the real embed to
      const reply = await interaction.reply({ content: "Creating party...", fetchReply: true });

      const party = createParty({
        messageId: reply.id,
        channelId: interaction.channelId,
        leaderId: interaction.user.id,
        activity,
        time,
        note,
        roleCaps,
      });

      await interaction.editReply({
        content: null,
        embeds: [buildPartyEmbed(party)],
        components: buildPartyButtons(party),
      });
      return;
    }

    if (sub === "list") {
      const active = getAllParties().filter((p) => p.channelId === interaction.channelId);
      if (active.length === 0) {
        return interaction.reply({
          content: "No active parties in this channel right now. Start one with `/party create`.",
          flags: MessageFlags.Ephemeral,
        });
      }
      const lines = active.map(
        (p) => `• **${p.activity}**${p.time ? ` — ${p.time}` : ""} (led by <@${p.leaderId}>)`
      );
      return interaction.reply({
        content: `**Active parties:**\n${lines.join("\n")}`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === "recall") {
      const query = interaction.options.getString("activity");
      const activeInChannel = getAllParties().filter((p) => p.channelId === interaction.channelId);

      if (activeInChannel.length === 0) {
        return interaction.reply({
          content: "No active parties in this channel to recall.",
          flags: MessageFlags.Ephemeral,
        });
      }

      let target;
      if (query) {
        const matches = activeInChannel.filter((p) =>
          p.activity.toLowerCase().includes(query.toLowerCase())
        );
        if (matches.length === 0) {
          const names = activeInChannel.map((p) => `• ${p.activity}`).join("\n");
          return interaction.reply({
            content: `No active party matches "${query}". Active parties here:\n${names}`,
            flags: MessageFlags.Ephemeral,
          });
        }
        if (matches.length > 1) {
          const names = matches.map((p) => `• ${p.activity}`).join("\n");
          return interaction.reply({
            content: `More than one party matches "${query}" — be more specific:\n${names}`,
            flags: MessageFlags.Ephemeral,
          });
        }
        target = matches[0];
      } else {
        if (activeInChannel.length > 1) {
          const names = activeInChannel.map((p) => `• ${p.activity}`).join("\n");
          return interaction.reply({
            content: `There's more than one active party here — specify which with \`/party recall activity:\`\n${names}`,
            flags: MessageFlags.Ephemeral,
          });
        }
        target = activeInChannel[0];
      }

      // Best-effort delete of the old (buried) message — if it's already
      // gone or we can't fetch it for some reason, we still recreate below.
      try {
        const oldMessage = await interaction.channel.messages.fetch(target.messageId);
        await oldMessage.delete();
      } catch (err) {
        // ignore — old message may already be deleted
      }

      const reply = await interaction.reply({ content: "Recalling party...", fetchReply: true });
      const party = rekeyParty(target.messageId, reply.id);

      await interaction.editReply({
        content: null,
        embeds: [buildPartyEmbed(party)],
        components: buildPartyButtons(party),
      });
      return;
    }
  },
};