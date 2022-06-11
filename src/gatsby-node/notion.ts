import { Client, LogLevel } from "@notionhq/client"
import crypto from "crypto"
import path from "path"

type ElementType<T> = T extends (infer U)[] ? U : never
type MatchType<T, U, V = never> = T extends U ? T : V
type PageObject = MatchType<
  ElementType<Awaited<ReturnType<Client["databases"]["query"]>>["results"]>,
  {
    properties: unknown
  }
>
type BlockObject = MatchType<
  ElementType<
    Awaited<ReturnType<Client["blocks"]["children"]["list"]>>["results"]
  >,
  { type: unknown }
> & {
  children?: BlockObject[]
}
type TextAnnotations = {
  bold: boolean
  italic: boolean
  strikethrough: boolean
  underline: boolean
  code: boolean
}
type TextNode = {
  type: "text"
  plain_text: string
  href: string | null
  annotations: TextAnnotations
}
type MentionNode = {
  type: "mention"
  plain_text: string
  href: string | null
  annotations: TextAnnotations
}
type EquationNode = {
  type: "equation"
  plain_text: string
  href: string | null
  annotations: TextAnnotations
}
type RichTextNode = TextNode | MentionNode | EquationNode

type RichText = Array<RichTextNode>

type RemoteImage = {
  url: string
  filename: string
}

type NotionContent = {
  dirname: string
  frontmatter: {
    title: string
    tags: string[]
    draft: boolean
    date: string
    updated_at: string
    source: string
    notion_page_id: string
  }
  remoteImages: RemoteImage[]
  content: string
}

export type Post = {
  dirname: string
  updated_at: string
  notion_page_id: string
}

export class Notion {
  private readonly client: Client
  constructor(options: { auth?: string }) {
    this.client = new Client({
      ...options,
      logLevel: LogLevel.DEBUG,
    })
  }
  public async fetchUpdatedContents(
    databaseId: string,
    savedPosts: Post[]
  ): Promise<NotionContent[]> {
    return await Promise.all(
      (
        await this.queryAllPages(databaseId)
      )
        .filter(
          page =>
            !page.archived &&
            "slug" in page.properties &&
            page.properties.slug.type === "rich_text" &&
            page.properties.slug.rich_text.length > 0
        )
        .map(notionContent)
        .filter(content => {
          const fm = content.frontmatter
          const old = savedPosts
            .filter(post => post.notion_page_id === fm.notion_page_id)
            .pop()
          return old ? old.updated_at !== fm.updated_at : true
        })
        .map(async content => {
          const blocks = await this.fetchChildBlocks(
            content.frontmatter.notion_page_id
          )
          return {
            ...content,
            remoteImages: blocks
              .filter(block => block.type === "image")
              .map(remoteImage),
            content:
              [
                "---",
                ...Object.entries(content.frontmatter).map(
                  ([key, value]) => `${key}: ${JSON.stringify(value)}`
                ),
                "---\n",
              ].join("\n") + blocks.map(block => markdown(block)).join(""),
          }
        })
    )
  }
  private async queryAllPages(databaseId: string): Promise<PageObject[]> {
    const pages: PageObject[] = []
    let cursor = null
    do {
      const { results, next_cursor, has_more } =
        await this.client.databases.query({
          database_id: databaseId,
          sorts: [{ timestamp: "created_time", direction: "descending" }],
        })
      for (const page of results) {
        if ("properties" in page) {
          pages.push(page as PageObject)
        }
      }
      cursor = has_more ? next_cursor : null
    } while (cursor !== null)
    return pages
  }
  private async fetchChildBlocks(parentId: string): Promise<BlockObject[]> {
    const blocks: BlockObject[] = []
    let cursor = null
    do {
      const { results, next_cursor, has_more } =
        await this.client.blocks.children.list({
          block_id: parentId,
        })
      for (const block of results) {
        if ("type" in block) {
          if (block.has_children) {
            const children = await this.fetchChildBlocks(block.id)
            blocks.push({ ...block, children } as BlockObject)
          } else {
            blocks.push({ ...block } as BlockObject)
          }
        }
      }
      cursor = has_more ? next_cursor : null
    } while (cursor !== null)
    return blocks
  }
}

function notionContent(page: PageObject): NotionContent {
  const { properties: props } = page
  const slug =
    "slug" in props && props.slug.type === "rich_text"
      ? plainText(props.slug.rich_text)
      : null
  return {
    dirname: `${formatDate(new Date(page.created_time))}-${slug}`,
    frontmatter: {
      title:
        "name" in props && props.name.type === "title"
          ? plainText(props.name.title)
          : "",
      tags:
        "tags" in props && props.tags.type === "multi_select"
          ? props.tags.multi_select.map(tag => `${tag.name}`)
          : [],
      draft:
        "publishable" in props && props.publishable.type === "checkbox"
          ? !props.publishable.checkbox
          : true,
      date: page.created_time,
      updated_at: page.last_edited_time,
      source: page.url,
      notion_page_id: page.id,
    },
    remoteImages: [],
    content: "",
  }
}

function formatDate(date: Date) {
  const t = new Date(date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }))
  return (
    `000${t.getFullYear()}`.slice(-4) +
    `0${t.getMonth() + 1}`.slice(-2) +
    `0${t.getDate()}`.slice(-2)
  )
}

function markdown(
  block: BlockObject,
  options?: { listDepth?: number }
): string {
  const listDepth = options?.listDepth ?? 0
  switch (block.type) {
    case "heading_1":
      return `# ${markdownInline(block.heading_1.rich_text)}\n\n`
    case "heading_2":
      return `## ${markdownInline(block.heading_2.rich_text)}\n\n`
    case "heading_3":
      return `### ${markdownInline(block.heading_3.rich_text)}\n\n`
    case "paragraph":
      return `\n${markdownInline(block.paragraph.rich_text)}\n\n`
    case "code":
      return (
        `\`\`\`${block.code.language ?? ""}\n` +
        `${plainText(block.code.rich_text)}\n\`\`\`\n\n`
      )
    case "bulleted_list_item":
      return (
        "  ".repeat(listDepth) +
        `- ${markdownInline(block.bulleted_list_item.rich_text)}\n` +
        (block.children
          ?.map(block => markdown(block, { listDepth: listDepth + 1 }))
          .join("") ?? "")
      )
    case "numbered_list_item":
      return (
        "  ".repeat(listDepth) +
        `1. ${markdownInline(block.numbered_list_item.rich_text)}\n` +
        (block.children
          ?.map(block => markdown(block, { listDepth: listDepth + 1 }))
          .join("") ?? "")
      )
    case "quote":
      return `> ${markdownInline(block.quote.rich_text)}\n\n`
    case "divider":
      return "---\n\n"
    case "bookmark":
      return `{{< embed "${block.bookmark.url}" >}}\n\n`
    case "link_preview":
      return `{{< embed "${block.link_preview.url}" >}}\n\n`
    case "callout":
      if (block.callout.icon?.type === "emoji") {
        return (
          `{{< callout "${block.callout.icon.emoji}">}}\n` +
          markdownInline(block.callout.rich_text) +
          "\n{{< /callout >}}\n\n"
        )
      } else {
        return (
          "{{< callout >}}\n" +
          markdownInline(block.callout.rich_text) +
          "\n{{< /callout >}}\n\n"
        )
      }
    case "image":
      const image = remoteImage(block)
      return `![${plainText(block.image.caption)}](./${image.filename})\n`
    case "equation":
      return `$$\n${block.equation.expression}\n$$\n\n`
    case "toggle":
      return (
        `{{<details "${plainText(block.toggle.rich_text)}">}}\n\n` +
        block.children?.map(block => markdown(block)).join("") +
        "\n\n{{< /details >}}\n\n"
      )
    default:
      return (
        `<pre hidden data-blocktype="${block.type}">\n` +
        `${JSON.stringify(block, null, 2)}\n</pre>\n\n`
      )
  }
}

function remoteImage(block: BlockObject): RemoteImage {
  if (block.type === "image") {
    const url =
      block.image.type === "external"
        ? block.image.external.url
        : block.image.type === "file"
        ? block.image.file.url
        : ""
    return {
      url,
      filename:
        crypto
          .createHash("md5")
          .update(url, "utf8")
          .digest("hex")
          .slice(0, 20) + path.extname(url.replace(/\?.*/, "")),
    }
  }
  return { url: "", filename: "" }
}

function markdownInline(text: RichText): string {
  return text
    .map((node: RichTextNode): string => {
      const { type, plain_text, href, annotations } = node
      if (type === "mention") {
        // mention is only available in Notion
        return ""
      }
      if (type === "equation") {
        return `$${plain_text}$`
      }
      return Object.entries(annotations)
        .reduce(
          (acc, annotation) => {
            const [key, flag] = annotation
            if (flag) {
              switch (key) {
                case "code":
                  return `\`${acc}\``
                case "bold":
                  return `**${acc}**`
                case "italic":
                  return acc.startsWith("*") ? `_${acc}_` : `*${acc}*`
                case "strikethrough":
                  return `~~${plain_text}~~`
                case "underline":
                  return `__${plain_text}__`
              }
            }
            return acc
          },
          href ? `[${plain_text}](${href})` : plain_text
        )
        .replace(/\n/g, "  \n")
    })
    .join("")
}

function plainText(text: RichText): string {
  return text.map(node => node.plain_text).join("")
}
