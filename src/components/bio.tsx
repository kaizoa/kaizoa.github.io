import * as React from "react"
import { useStaticQuery, graphql } from "gatsby"
import { GatsbyImage, getImage, IGatsbyImageData } from "gatsby-plugin-image"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { IconProp, library } from "@fortawesome/fontawesome-svg-core"
import { faEnvelope } from "@fortawesome/free-solid-svg-icons"
import { fab } from "@fortawesome/free-brands-svg-icons"
import { config } from "@fortawesome/fontawesome-svg-core"

config.autoAddCss = true
library.add(fab, faEnvelope)

const Bio = () => {
  const data = useStaticQuery<GatsbyTypes.BioQuery>(graphql`
    query Bio {
      allFile(filter: { name: { eq: "profile" } }) {
        edges {
          node {
            childImageSharp {
              gatsbyImageData(
                layout: FIXED
                width: 50
                height: 50
                placeholder: BLURRED
                formats: [AUTO, WEBP, AVIF]
              )
            }
          }
        }
      }
      site {
        siteMetadata {
          author {
            name
            summary
          }
          contacts {
            mail
            github
            instagram
          }
        }
      }
    }
  `)

  const author = data.site?.siteMetadata?.author
  const avatar = getImage(
    data.allFile?.edges?.[0]?.node?.childImageSharp?.gatsbyImageData
  ) as IGatsbyImageData
  const contacts = React.useMemo(
    () => [
      {
        icon: "envelope" as IconProp,
        label: data.site?.siteMetadata?.contacts?.mail,
        href: "mailto:" + data.site?.siteMetadata?.contacts?.mail,
      },
      {
        icon: ["fab", "github"] as IconProp,
        label: "GitHub",
        href: "https://github.com/" + data.site?.siteMetadata?.contacts?.github,
      },
      {
        icon: ["fab", "instagram"] as IconProp,
        label: "Instagram",
        href:
          "https://instagram.com/" +
          data.site?.siteMetadata?.contacts?.instagram,
      },
    ],
    [data.site?.siteMetadata?.contacts]
  )

  return (
    <div className="bio">
      <GatsbyImage
        image={avatar}
        alt={author?.name || ""}
        className="bio-avatar"
        imgStyle={{ borderRadius: "50%" }}
      />
      <div>
        <div className="bio-author">{author?.name}</div>
        <div className="bio-summary">{author?.summary || null}</div>
        {contacts.map(({ icon, label, href }) => (
          <a className="bio-contact" href={href}>
            <FontAwesomeIcon icon={icon} />
            {" " + label}
          </a>
        ))}
      </div>
    </div>
  )
}

export default Bio
