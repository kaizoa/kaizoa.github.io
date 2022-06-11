import * as React from "react"
import { WindowLocation } from "@reach/router"
import { graphql, Link, useStaticQuery } from "gatsby"

type Props = {
  location: WindowLocation<unknown>
  title: string
  children?: React.ReactNode
}

const Layout: React.FC<Props> = ({ location, title, children }) => {
  const data = useStaticQuery<GatsbyTypes.LayoutQuery>(graphql`
    query Layout {
      site {
        siteMetadata {
          author {
            name
          }
        }
      }
    }
  `)
  const author = data.site?.siteMetadata?.author?.name
  const rootPath = `${__PATH_PREFIX__}/`
  const isRootPath = location.pathname === rootPath
  let header

  if (isRootPath) {
    header = (
      <h1 className="main-heading">
        <Link to="/">{title}</Link>
      </h1>
    )
  } else {
    header = (
      <Link className="header-link-home" to="/">
        {title}
      </Link>
    )
  }

  return (
    <div className="global-wrapper" data-is-root-path={isRootPath}>
      <header className="global-header">{header}</header>
      <main>{children}</main>
      <footer>{"© " + new Date().getFullYear() + ", " + author}</footer>
    </div>
  )
}

export default Layout
