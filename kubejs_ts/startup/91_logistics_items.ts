StartupEvents.registry("item", (event) => {
  event
    .create("excavation_survey_tool")
    .displayName("Excavation Survey Tool")
    .maxStackSize(1)
    .rarity("uncommon")
    .tooltip("Right-click to inspect this chunk's excavation profile.");
});
