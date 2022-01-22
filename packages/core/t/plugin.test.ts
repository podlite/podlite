import { Plugin } from "@podlite/schema";
import { podlite, toAnyRules } from "../src";


const testPlugin:Plugin = {
    toAst: () => () => {

    },
    toHtml: () => () => {

    },
}

test("plugin", () => {
const proc = podlite({importPlugins:false}).use({Test:testPlugin})
const toAstPlugins= toAnyRules('toAst', proc.getPlugins())
const toHtmlPlugins= toAnyRules('toHtml', proc.getPlugins())
const toUNKNOWNPlugins= toAnyRules('toUNKNOWN', proc.getPlugins())
expect(toAstPlugins).toHaveProperty("Test");
expect(toHtmlPlugins).toHaveProperty("Test");
expect(toUNKNOWNPlugins).not.toHaveProperty("Test");

})
