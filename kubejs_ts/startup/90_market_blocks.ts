StartupEvents.registry("block", (event) => {
  event
    .create("market_terminal")
    .soundType("metal")
    .hardness(3.0)
    .requiresTool(true)
    .texture("numismatics:block/shop/register/smart_register_back")
    .displayName("Market Terminal");

  event
    .create("mining_outpost_controller")
    .soundType("metal")
    .hardness(3.0)
    .requiresTool(true)
    .texture("numismatics:block/depositor/brass_depositor_select")
    .displayName("Mining Outpost Controller");

  event
    .create("village_market_controller")
    .soundType("metal")
    .hardness(3.0)
    .requiresTool(true)
    .texture("numismatics:block/bank_terminal/bank_terminal_back")
    .displayName("Village Market Controller");

  event
    .create("hub_dispatch_controller")
    .soundType("metal")
    .hardness(3.0)
    .requiresTool(true)
    .texture("numismatics:block/depositor/andesite_depositor_select")
    .displayName("Hub Dispatch Controller");
});
