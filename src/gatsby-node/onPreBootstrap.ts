/* eslint-disable @typescript-eslint/no-non-null-assertion */
import path from "path"
import { GatsbyNode } from "gatsby"
import { Notion, Post } from "./notion"
import fs from "fs"
import https from "https"

export const onPreBootstrap: GatsbyNode["onPreBootstrap"] = async () => {
  const cwd = process.cwd()
  const blogDir = path.join(cwd, "content/blog")
  const posts = fs
    .readdirSync(blogDir)
    .filter(file => file !== "dummy")
    .map(
      dirname =>
        fs
          .readFileSync(path.join(blogDir, dirname, "index.md"), "utf8")
          .split("\n")
          .filter(
            line =>
              line.startsWith("notion_page_id:") ||
              line.startsWith("updated_at:")
          )
          .map(line => {
            const i = line.indexOf(":")
            return {
              k: line.slice(0, i),
              v: line
                .slice(i + 1)
                .trim()
                .replace(/^['"](.*)['"]$/, "$1"),
            }
          })
          .reduce((acc, { k, v }) => ({ ...acc, [k]: v }), {
            dirname,
          }) as Post
    )
    .filter(post => post.notion_page_id && post.updated_at)
  const notion = new Notion({ auth: process.env.GATSBY_NOTION_AUTH })
  ;(
    await notion.fetchUpdatedContents(
      process.env.GATSBY_NOTION_DATABASE_ID as string,
      posts
    )
  ).forEach(content => {
    const dir = path.join(blogDir, content.dirname)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    content.remoteImages.forEach(image => {
      https
        .request(image.url, res =>
          res.pipe(fs.createWriteStream(path.join(dir, image.filename)))
        )
        .end()
    })
    fs.writeFileSync(path.join(dir, "index.md"), content.content)
    fs.readdirSync(dir)
      .filter(
        filename =>
          filename.match(/^[\da-z]{20}\..*$/) &&
          !content.remoteImages.find(image => image.filename === filename)
      )
      .forEach(filename => fs.unlinkSync(path.join(dir, filename)))
  })
}
