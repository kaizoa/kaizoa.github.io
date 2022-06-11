import { GatsbyNode } from 'gatsby';
import { createRemoteFileNode } from 'gatsby-source-filesystem';

// sourceNodesにて外部画像のファイルノードを作成する
export const sourceNodes: GatsbyNode['sourceNodes'] = async ({
  actions,
  createNodeId,
  cache,
}) => {
  const remoteImages = [
    { url: 'https://github.com/kaizoa.png', name: 'avatar' },
  ];

  await Promise.all(
    remoteImages.map(async image => {
      const fileNode = await createRemoteFileNode({
        url: image.url,
        cache,
        createNode: actions.createNode,
        createNodeId: createNodeId,
      });
      await actions.createNodeField({
        node: fileNode,
        name: image.name,
        value: 'true',
      });
      await actions.createNodeField({
        node: fileNode,
        name: 'link',
        value: image.url,
      });
      return fileNode;
    })
  );
};
