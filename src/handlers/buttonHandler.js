const {
  MessageFlags,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const {
  getParty,
  joinRole,
  removeMember,
  deleteParty,
  isMember,
  getAllMemberIds,
  ROLE_LABELS,
} = require("./partyManager");
const { buildPartyEmbed, buildPartyButtons, getSlotCode } = require("./uiBuilders");
const { hasSubclasses, getSubclasses } = require("./roleClasses");
const { createLoot, getLoot, markSold, markPaid } = require("./lootManager");

// Refreshes the live party embed/buttons on the original party message.
// Needed when the update comes from an ephemeral message (the subclass
// picker) rather than a direct interaction on the party message itself.
async function refreshPartyMessage(client, party) {
  const channel = await client.channels.fetch(party.channelId);
  const message = await channel.messages.fetch(party.messageId);
  await message.edit({
    embeds: [buildPartyEmbed(party)],
    components: buildPartyButtons(party),
  });
}

// Builds an ephemeral "choose your class" prompt using a dropdown
// (StringSelectMenu) instead of a row of buttons.
function buildSubclassPrompt(messageId, roleKey) {
  const subclasses = getSubclasses(roleKey);
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`party:pickclass:${messageId}:${roleKey}`)
    .setPlaceholder(`Choose your ${ROLE_LABELS[roleKey]} class`)
    .addOptions(subclasses.map((subclass) => ({ label: subclass, value: subclass })));

  return {
    content: `Choose your ${ROLE_LABELS[roleKey]} class:`,
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: MessageFlags.Ephemeral,
  };
}

// Builds the loot thread's name in the requested format:
// [Party name] [Date Cleared] [Loot holder]
// Discord thread names are capped at 100 characters, so this truncates
// if needed rather than letting the API call fail.
function buildFinishThreadName(activity, dateCleared, lootHolder) {
  const name = `[${activity}] [${dateCleared}] [${lootHolder}]`;
  return name.length > 100 ? name.slice(0, 100) : name;
}

// Builds the roster (same PL/PR/SM code style as the party listing) once,
// at finish-time, from the party that's about to be deleted. Each entry
// tracks its own `paid` flag so the Gaji button can check members off
// individually. The leader gets a 👑 entry if they didn't fill a role.
function buildLootRoster(party) {
  const roster = [];
  for (const [roleKey, role] of Object.entries(party.roles)) {
    role.members.forEach((member, i) => {
      roster.push({
        code: getSlotCode(roleKey, i, role.cap),
        userId: member.userId,
        subclass: member.subclass,
        paid: false,
      });
    });
  }
  if (!isMember(party, party.leaderId)) {
    roster.push({ code: "👑", userId: party.leaderId, subclass: null, paid: false });
  }
  return roster;
}

// Builds the loot recap embed from a lootManager record. Sold items get
// a ✅ marker; unsold ones stay numbered so the Sold dropdown's options
// line up with what's shown here.
function buildLootRecapEmbed(record) {
  const embed = new EmbedBuilder()
    .setTitle(`📦 Loot recap — ${record.activity}`)
    .setColor(0xf1c40f);

  const lootLines = record.items.length
    ? record.items
        .map((item, i) =>
          item.sold
            ? `✅ ~~${item.name}~~${item.price ? ` — ${item.price}` : ""}`
            : `${i + 1}. ${item.name}`
        )
        .join("\n")
    : "_none_";

  embed.setDescription(
    `**Tanggal clear:** ${record.dateCleared}\n**Bawa loot:** ${record.lootHolder}\n**Loot:**\n${lootLines}`
  );

  if (record.roster && record.roster.length > 0) {
    const maxCodeLength = Math.max(...record.roster.map((e) => e.code.length));
    const rosterLines = record.roster.map((e) => {
      const value = e.subclass ? `${e.subclass} <@${e.userId}>` : `<@${e.userId}>`;
      return `${e.code.padEnd(maxCodeLength)} : ${value}${e.paid ? " ✅" : ""}`;
    });
    embed.addFields({ name: "\u200b", value: rosterLines.join("\n"), inline: false });
  }

  return embed;
}

async function handleButton(interaction) {
  const parts = interaction.customId.split(":");
  const action = parts[1];

  if (action === "soldbtn") {
    const recapMessageId = parts[2];
    const record = getLoot(recapMessageId);
    if (!record) {
      return interaction.reply({
        content: "Data loot untuk party ini sudah tidak tersedia.",
        flags: MessageFlags.Ephemeral,
      });
    }
    const unsoldOptions = record.items
      .map((item, i) => ({ label: item.name.slice(0, 100), value: String(i), sold: item.sold }))
      .filter((opt) => !opt.sold);

    if (unsoldOptions.length === 0) {
      return interaction.reply({
        content: "Semua item sudah ditandai terjual.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`party:soldselect:${recapMessageId}`)
      .setPlaceholder("Pilih item yang sudah terjual")
      .addOptions(unsoldOptions.slice(0, 25)); // Discord select menus cap at 25 options

    return interaction.reply({
      content: "Item mana yang sudah terjual?",
      components: [new ActionRowBuilder().addComponents(menu)],
      flags: MessageFlags.Ephemeral,
    });
  }

  if (action === "gajibtn") {
    const recapMessageId = parts[2];
    const record = getLoot(recapMessageId);
    if (!record) {
      return interaction.reply({
        content: "Data party ini sudah tidak tersedia.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const unpaidEntries = record.roster
      .map((entry, i) => ({ entry, i }))
      .filter(({ entry }) => !entry.paid);

    if (unpaidEntries.length === 0) {
      return interaction.reply({
        content: "Semua member sudah menerima gaji.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const options = [];
    for (const { entry, i } of unpaidEntries.slice(0, 25)) {
      let username = entry.userId;
      try {
        const user = await interaction.client.users.fetch(entry.userId);
        username = user.username;
      } catch (err) {
        // If the fetch fails for some reason, fall back to showing the raw ID.
      }
      options.push({ label: username.slice(0, 100), value: String(i) });
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`party:gajiselect:${recapMessageId}`)
      .setPlaceholder("Pilih member yang sudah digaji")
      .addOptions(options); // already capped at 25 above

    return interaction.reply({
      content: "Member mana yang sudah menerima gaji?",
      components: [new ActionRowBuilder().addComponents(menu)],
      flags: MessageFlags.Ephemeral,
    });
  }

  const roleKey = parts[2];
  const party = getParty(interaction.message.id);

  if (!party) {
    return interaction.reply({
      content: "This party no longer exists.",
      flags: MessageFlags.Ephemeral,
    });
  }

  if (action === "ping") {
    if (!isMember(party, interaction.user.id)) {
      return interaction.reply({
        content: "You need to join the party before you can ping it.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`party:pingmodal:${party.messageId}`)
      .setTitle("Ping the party");

    const messageInput = new TextInputBuilder()
      .setCustomId("message")
      .setLabel("What do you want to say?")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("e.g. Forming up now, get in voice!")
      .setMaxLength(300)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(messageInput));
    return interaction.showModal(modal);
  }

  if (action === "kick") {
    if (interaction.user.id !== party.leaderId) {
      return interaction.reply({
        content: "Only the party leader can kick members.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const options = [];
    for (const [roleKey, role] of Object.entries(party.roles)) {
      for (const member of role.members) {
        if (member.userId === party.leaderId) continue; // leader can't kick themselves this way

        let username = member.userId;
        try {
          const user = await interaction.client.users.fetch(member.userId);
          username = user.username;
        } catch (err) {
          // If the fetch fails for some reason, fall back to showing the raw ID.
        }

        const roleLabel = ROLE_LABELS[roleKey];
        const label = member.subclass
          ? `${username} — ${roleLabel} (${member.subclass})`
          : `${username} — ${roleLabel}`;
        options.push({ label: label.slice(0, 100), value: member.userId });
      }
    }

    if (options.length === 0) {
      return interaction.reply({
        content: "There's no one to kick — the party has no members besides you.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`party:kickselect:${party.messageId}`)
      .setPlaceholder("Choose a member to kick")
      .addOptions(options.slice(0, 25)); // Discord select menus cap at 25 options

    return interaction.reply({
      content: "Who do you want to kick from the party?",
      components: [new ActionRowBuilder().addComponents(menu)],
      flags: MessageFlags.Ephemeral,
    });
  }

  if (action === "finish") {
    if (interaction.user.id !== party.leaderId) {
      return interaction.reply({
        content: "Only the party leader can finish this party.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`party:finishmodal:${party.messageId}`)
      .setTitle("Finish party");

    const lootHolderInput = new TextInputBuilder()
      .setCustomId("loot_holder")
      .setLabel("Siapa yang bawa loot?")
      .setStyle(TextInputStyle.Short)
      .setMaxLength(100)
      .setRequired(true);

    const lootListInput = new TextInputBuilder()
      .setCustomId("loot_list")
      .setLabel("Lootnya apa aja?")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Satu item per baris")
      .setMaxLength(500)
      .setRequired(true);

    const dateInput = new TextInputBuilder()
      .setCustomId("date_cleared")
      .setLabel("Tanggal clear")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("e.g. 10/07/2026")
      .setMaxLength(30)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(lootHolderInput),
      new ActionRowBuilder().addComponents(lootListInput),
      new ActionRowBuilder().addComponents(dateInput)
    );

    return interaction.showModal(modal);
  }

  if (action === "join") {
    if (hasSubclasses(roleKey)) {
      return interaction.reply(buildSubclassPrompt(party.messageId, roleKey));
    }
    const result = joinRole(party.messageId, interaction.user.id, roleKey);
    if (result === "full") {
      return interaction.reply({
        content: "That role just filled up — try another one!",
        flags: MessageFlags.Ephemeral,
      });
    }
  } else if (action === "leave") {
    const removed = removeMember(party.messageId, interaction.user.id);
    if (!removed) {
      return interaction.reply({
        content: "You're not currently signed up for this party.",
        flags: MessageFlags.Ephemeral,
      });
    }
  } else if (action === "disband") {
    if (interaction.user.id !== party.leaderId) {
      return interaction.reply({
        content: "Only the party leader can disband this party.",
        flags: MessageFlags.Ephemeral,
      });
    }
    deleteParty(party.messageId);
    return interaction.update({
      content: "💥 This party has been disbanded.",
      embeds: [],
      components: [],
    });
  }

  return interaction.update({
    embeds: [buildPartyEmbed(party)],
    components: buildPartyButtons(party),
  });
}

// Handles the dropdown selection from the subclass picker.
// customId format: party:pickclass:<messageId>:<role>
async function handleSelectMenu(interaction) {
  const parts = interaction.customId.split(":");
  const action = parts[1];

  if (action === "kickselect") {
    const [, , messageId] = parts;
    const party = getParty(messageId);

    if (!party) {
      return interaction.update({ content: "This party no longer exists.", components: [] });
    }
    if (interaction.user.id !== party.leaderId) {
      return interaction.update({
        content: "Only the party leader can kick members.",
        components: [],
      });
    }

    const kickedId = interaction.values[0];
    const removed = removeMember(messageId, kickedId);
    if (!removed) {
      return interaction.update({
        content: "That member already left the party.",
        components: [],
      });
    }

    await refreshPartyMessage(interaction.client, party);
    return interaction.update({
      content: `Kicked <@${kickedId}> from the party.`,
      components: [],
    });
  }

  if (action === "soldselect") {
    const [, , recapMessageId] = parts;
    const index = interaction.values[0];

    const record = getLoot(recapMessageId);
    if (!record) {
      return interaction.update({
        content: "Data loot untuk party ini sudah tidak tersedia.",
        components: [],
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`party:soldprice:${recapMessageId}:${index}`)
      .setTitle("Harga jual");

    const hargaInput = new TextInputBuilder()
      .setCustomId("harga")
      .setLabel(`Harga untuk "${record.items[index].name}"`.slice(0, 45))
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("misal 500k, 1.2m, 750rb")
      .setMaxLength(30)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(hargaInput));
    return interaction.showModal(modal);
  }

  if (action === "gajiselect") {
    const [, , recapMessageId] = parts;
    const index = Number(interaction.values[0]);

    const record = markPaid(recapMessageId, index);
    if (!record) {
      return interaction.update({
        content: "Data party ini sudah tidak tersedia.",
        components: [],
      });
    }

    try {
      const recapMessage = await interaction.channel.messages.fetch(recapMessageId);
      await recapMessage.edit({ embeds: [buildLootRecapEmbed(record)] });
    } catch (err) {
      // Recap message may have been deleted — not fatal, the payment is still recorded.
    }

    return interaction.update({
      content: `✅ Gaji diberikan ke <@${record.roster[index].userId}>`,
      components: [],
    });
  }

  if (action !== "pickclass") return;

  const [, , messageId, roleKey] = parts;
  const subclass = interaction.values[0];

  const party = getParty(messageId);
  if (!party) {
    return interaction.update({
      content: "This party no longer exists.",
      components: [],
    });
  }

  const result = joinRole(messageId, interaction.user.id, roleKey, subclass);
  if (result === "full") {
    return interaction.update({
      content: "That role just filled up — try another one!",
      components: [],
    });
  }

  await refreshPartyMessage(interaction.client, party);
  return interaction.update({
    content: `Joined as **${subclass}** ${ROLE_LABELS[roleKey]}!`,
    components: [],
  });
}

// Handles submission of the "ping the party" modal.
// customId format: party:pingmodal:<messageId>
async function handleModalSubmit(interaction) {
  const parts = interaction.customId.split(":");
  const action = parts[1];

  if (action === "finishmodal") {
    return handleFinishModalSubmit(interaction);
  }

  if (action === "soldprice") {
    const [, , recapMessageId, indexStr] = parts;
    const index = Number(indexStr);
    const harga = interaction.fields.getTextInputValue("harga").trim();

    const record = markSold(recapMessageId, index, interaction.user.id, harga);
    if (!record) {
      return interaction.reply({
        content: "Data loot untuk party ini sudah tidak tersedia.",
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      const recapMessage = await interaction.channel.messages.fetch(recapMessageId);
      await recapMessage.edit({ embeds: [buildLootRecapEmbed(record)] });
    } catch (err) {
      // Recap message may have been deleted — not fatal, the sale is still recorded.
    }

    return interaction.reply({
      content: `✅ Ditandai terjual: **${record.items[index].name}** — ${harga}`,
      flags: MessageFlags.Ephemeral,
    });
  }

  if (action !== "pingmodal") return;

  const [, , messageId] = parts;
  const party = getParty(messageId);
  if (!party) {
    return interaction.reply({
      content: "This party no longer exists.",
      flags: MessageFlags.Ephemeral,
    });
  }

  // Double-check membership at submit time too — someone could leave the
  // party in the time between opening the modal and submitting it.
  if (!isMember(party, interaction.user.id)) {
    return interaction.reply({
      content: "You need to join the party before you can ping it.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const message = interaction.fields.getTextInputValue("message");
  const memberIds = getAllMemberIds(party);
  const mentions = memberIds.map((id) => `<@${id}>`).join(" ");

  return interaction.reply({
    content: `📣 **${interaction.user.username}** on **${party.activity}**:\n${message}\n\n${mentions}`,
  });
}

// Handles submission of the "finish party" modal. Deletes the party,
// removes its message, and creates a loot-recap thread with every member
// (plus the leader) added to it.
// customId format: party:finishmodal:<messageId>
async function handleFinishModalSubmit(interaction) {
  const [, , messageId] = interaction.customId.split(":");
  const party = getParty(messageId);

  if (!party) {
    return interaction.reply({
      content: "This party no longer exists.",
      flags: MessageFlags.Ephemeral,
    });
  }

  if (interaction.user.id !== party.leaderId) {
    return interaction.reply({
      content: "Only the party leader can finish this party.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const lootHolder = interaction.fields.getTextInputValue("loot_holder");
  const lootList = interaction.fields.getTextInputValue("loot_list");
  const dateCleared = interaction.fields.getTextInputValue("date_cleared");

  // Everyone who joined a role, plus the leader (who may not have joined
  // a role themselves), gets added to the loot thread.
  const memberIds = new Set(getAllMemberIds(party));
  memberIds.add(party.leaderId);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Party is done — clear it from memory and remove its message first.
  deleteParty(messageId);
  try {
    const oldChannel = await interaction.client.channels.fetch(party.channelId);
    const oldMessage = await oldChannel.messages.fetch(party.messageId);
    await oldMessage.delete();
  } catch (err) {
    // Message may already be gone — not fatal, keep going.
  }

  const threadName = buildFinishThreadName(party.activity, dateCleared, lootHolder);
  const mentions = Array.from(memberIds).map((id) => `<@${id}>`).join(" ");

  // One loot item per line, blank lines dropped — this becomes the list
  // of options in the Sold dropdown, in the same order shown in the embed.
  const lootItems = lootList
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((name) => ({ name, sold: false, soldTo: null }));

  const lootRecord = {
    activity: party.activity,
    dateCleared,
    lootHolder,
    roster: buildLootRoster(party),
    items: lootItems,
  };
  const recapEmbed = buildLootRecapEmbed(lootRecord);

  // If LOOT_THREAD_CHANNEL_ID is set in .env, loot threads get created
  // there instead of the party's own channel. Falls back to the party's
  // channel if unset or if that channel can't be fetched.
  let threadChannel = interaction.channel;
  if (process.env.LOOT_THREAD_CHANNEL_ID) {
    try {
      threadChannel = await interaction.client.channels.fetch(process.env.LOOT_THREAD_CHANNEL_ID);
    } catch (err) {
      // Fall back to the current channel if the configured one is invalid
      // (wrong ID, bot removed from it, etc.) rather than failing outright.
    }
  }

  // Forum channels create threads differently from regular text channels:
  // the starting message must be included in the creation call itself
  // (there's no separate "create, then send" step), and they don't take
  // the same `type` option a text channel does.
  const isForum = threadChannel.type === ChannelType.GuildForum;

  let thread;
  try {
    if (isForum) {
      thread = await threadChannel.threads.create({
        name: threadName,
        message: { content: mentions, embeds: [recapEmbed] },
        reason: `Loot thread for finished party: ${party.activity}`,
      });
    } else {
      thread = await threadChannel.threads.create({
        name: threadName,
        type: ChannelType.PublicThread,
        autoArchiveDuration: 1440,
        reason: `Loot thread for finished party: ${party.activity}`,
      });
    }
  } catch (err) {
    return interaction.editReply({
      content:
        "Party was finished, but I couldn't create the loot thread — check that I have the " +
        "\"Create Public Threads\" permission (or \"Create Posts\" for forum channels) there.",
    });
  }

  for (const id of memberIds) {
    try {
      await thread.members.add(id);
    } catch (err) {
      // Skip members the bot can't add (e.g. they left the server) —
      // not worth failing the whole thread over.
    }
  }

  // Text-channel threads still need the recap message sent explicitly —
  // forum posts already got it bundled into the creation call above.
  let recapMessage;
  if (isForum) {
    recapMessage = await thread.fetchStarterMessage();
  } else {
    recapMessage = await thread.send({
      content: mentions, // kept as plain content so it actually pings — mentions inside embeds don't notify
      embeds: [recapEmbed],
    });
  }

  // Now that we know the recap message's ID, register the loot record
  // under it and attach the Sold button (its customId needs that ID).
  createLoot(recapMessage.id, lootRecord);
  const soldRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`party:soldbtn:${recapMessage.id}`)
      .setLabel("SOLD")
      .setEmoji("💰")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`party:gajibtn:${recapMessage.id}`)
      .setLabel("GAJI")
      .setEmoji("💵")
      .setStyle(ButtonStyle.Primary)
  );
  await recapMessage.edit({ components: [soldRow] });

  return interaction.editReply({
    content: `✅ Party finished! Loot thread created: ${thread}`,
  });
}

module.exports = { handleButton, handleSelectMenu, handleModalSubmit, buildFinishThreadName };