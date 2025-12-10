import {
    IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';
import { Neo4jGraph } from '@langchain/community/graphs/neo4j_graph';
import { Neo4jVectorStore } from '@langchain/community/vectorstores/neo4j_vector';
import type { Embeddings } from '@langchain/core/embeddings';

export class Neo4j implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Neo4j',
		name: 'neo4j',
		icon: 'file:neo4j.svg',
		usableAsTool: true,
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Work with Neo4j database',
		defaults: {
			name: 'Neo4j',
		},
		inputs: `={{
			((parameters) => {
				const mode = parameters?.mode;
                const resource = parameters?.resource;
                const inputs = [{ displayName: "", type: "${NodeConnectionTypes.Main}"}]

				if (resource === 'vectorStore') {
					inputs.push({ displayName: "Embedding", type: "${NodeConnectionTypes.AiEmbedding}", required: true, maxConnections: 1})
				}
				return inputs
			})($parameter)
		}}`,
		outputs: ['main'],
		credentials: [
			{
				name: 'neo4jApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Vector Store',
						value: 'vectorStore',
					},
					{
						name: 'Graph Database',
						value: 'graphDb',
					},
				],
				default: 'vectorStore',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['vectorStore'],
					},
				},
				options: [
					{
						name: 'Similarity Search',
						value: 'similaritySearch',
						action: 'Similarity search a vector store',
					},
					{
						name: 'Add Texts',
						value: 'addTexts',
						action: 'Add texts a vector store',
					}
				],
				default: 'similaritySearch',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['graphDb'],
					},
				},
				options: [
					{
						name: 'Execute Query',
						value: 'executeQuery',
						action: 'Execute query a graph db',
					},
					{
						name: 'Create Node',
						value: 'createNode',
						action: 'Create node a graph db',
					},
					{
						name: 'Create Relationship',
						value: 'createRelationship',
						action: 'Create relationship a graph db',
					},
					{
						name: 'Get Schema',
						value: 'getSchema',
						action: 'Get schema a graph db',
					},
				],
				default: 'executeQuery',
			},
			// Vector Store Parameters
			{
				displayName: 'Index Name',
				name: 'indexName',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['vectorStore', 'graphDb']
					},
				},
				default: 'vector',
				description: 'The index name to use',
			},
			{
				displayName: 'Query Text',
				name: 'queryText',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['vectorStore'],
						operation: ['similaritySearch'],
					},
				},
				default: '',
				description: 'The text to search for similar vectors',
			},
			{
				displayName: 'Options',
				name: 'moreOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						resource: ['vectorStore'],
						operation: ['similaritySearch'],
					},
				},
				options: [
					{
						displayName: 'Distance Metric',
						name: 'distanceMetric',
						type: 'options',
						default: 'COSINE',
						description: 'The distance metric to use',
						options: [
							{
								name: 'Cosine',
								value: 'COSINE',
							},
							{
								name: 'Dot Product',
								value: 'DOT_PRODUCT',
							},
							{
								name: 'Euclidean',
								value: 'EUCLIDEAN_DISTANCE',
							},
							{
								name: 'Jaccard',
								value: 'JACCARD',
							},
							{
								name: 'Max Inner Product',
								value: 'MAX_INNER_PRODUCT',
							}
						],
					},
					{
						displayName: 'Metadata Filter',
						name: 'metadataFilter',
						type: 'json',
						default: '{}',
						description: 'JSON object to filter results by metadata properties',
					},
					{
						displayName: 'Retrieval Query',
						name: 'retrievalQuery',
						type: 'string',
						default: '',
						description: 'The Cypher query to execute',
					},
				],
			},
			{
				displayName: 'Texts',
				name: 'texts',
				type: 'string',
				typeOptions: {
					multipleValues: true,
				},
				required: true,
				displayOptions: {
					show: {
						resource: ['vectorStore'],
						operation: ['addTexts'],
					},
				},
				default: [],
				description: 'The texts to add to the vector store',
			},
			// Graph DB Parameters
			{
				displayName: 'As String',
				name: 'schemaAsString',
				type: 'boolean',
				required: true,
				displayOptions: {
					show: {
						resource: ['graphDb'],
						operation: ['getSchema'],
					},
				},
				default: false,
				description: 'Whether to return the schema as a string or object',
			},
			{
				displayName: 'Cypher Query',
				name: 'cypherQuery',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['graphDb'],
						operation: ['executeQuery'],
					},
				},
				default: '',
				description: 'The Cypher query to execute',
			},
			{
				displayName: 'Node Label',
				name: 'nodeLabel',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['graphDb'],
						operation: ['createNode'],
					},
				},
				default: '',
				description: 'The label for the node',
			},
			{
				displayName: 'Node Properties',
				name: 'nodeProperties',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['graphDb'],
						operation: ['createNode'],
					},
				},
				default: '{}',
				description: 'The properties of the node as JSON string',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const credentials = await this.getCredentials('neo4jApi');
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;
		console.log(resource+" - "+operation);
		const config = {
			url: credentials.uri as string, // URL for the Neo4j instance
			username: credentials.username as string, // Username for Neo4j authentication
			password: credentials.password as string, // Password for Neo4j authentication
			database: credentials.database as string,
			//indexName: this.getNodeParameter('indexName', 0) as string,
			//embeddingNodeProperty: "embedding",
			textNodeProperties: ["text"],
		  };

		try {
			if (resource === 'vectorStore') {
                const embeddings = (await this.getInputConnectionData(
                    NodeConnectionTypes.AiEmbedding,
                    0,
                )) as Embeddings;
				const moreOptions = this.getNodeParameter('moreOptions', 0) as { metadataFilter?: string, retrievalQuery?: string, distanceMetric?: string };
				const config_vector = {
					...config,
					retrievalQuery: moreOptions.retrievalQuery ? moreOptions.retrievalQuery : undefined,
					distanceMetric: moreOptions.distanceMetric ? moreOptions.distanceMetric : 'COSINE',
					embeddingNodeProperty: "embedding",
					searchType: "vector" as const,
				}

				const vectorStore = await Neo4jVectorStore.fromExistingIndex(
					embeddings,
					config_vector
				  );

				  try {
					if (operation === 'similaritySearch') {
						const queryText = this.getNodeParameter('queryText', 0) as string;
						const moreOptions = this.getNodeParameter('moreOptions', 0) as { metadataFilter?: string, retrievalQuery?: string, distanceMetric?: string };
						const metadataFilter = moreOptions.metadataFilter ? JSON.parse(moreOptions.metadataFilter) : {};
						const queryEmbedding = await embeddings.embedQuery(queryText);
						const results = await vectorStore.similaritySearchVectorWithScore(queryEmbedding, 4, '',metadataFilter);
						return [this.helpers.returnJsonArray(results.map(([doc, score]) => ({
							content: doc.pageContent,
							score: score,
							...doc.metadata
						})))];
					}

					if (operation === 'addTexts') {
						const texts = this.getNodeParameter('texts', 0) as string[];
						await vectorStore.addDocuments(texts.map(text => ({ pageContent: text, metadata: {} })));
						return [this.helpers.returnJsonArray([{ success: true }])];
					}

				} finally {
					await vectorStore.close();
				}
			}

			if (resource === 'graphDb') {
				const graph = await Neo4jGraph.initialize(config);

				try {
					if (operation === 'getSchema') {
						const asString = this.getNodeParameter('schemaAsString', 0) as boolean;
						if(asString) {
							const result = {
								"schema": await graph.getSchema()
							}
							return [this.helpers.returnJsonArray([JSON.parse(JSON.stringify(result))])];
						} else {
							const result = await graph.getStructuredSchema();
							return [this.helpers.returnJsonArray([JSON.parse(JSON.stringify(result))])];
						}
					}

					if (operation === 'executeQuery') {
						const cypherQuery = this.getNodeParameter('cypherQuery', 0) as string;
						const result = await graph.query(cypherQuery);
						console.log(result);
						return [this.helpers.returnJsonArray(result)];
					}

					if (operation === 'createNode') {
						const nodeLabel = this.getNodeParameter('nodeLabel', 0) as string;
						const nodeProperties = JSON.parse(
							this.getNodeParameter('nodeProperties', 0) as string,
						);
						const query = `CREATE (n:${nodeLabel} $props) RETURN n`;
						const result = await graph.query(query, { props: nodeProperties });
						return [this.helpers.returnJsonArray(result)];
					}

					if (operation === 'createRelationship') {
						throw new NodeOperationError(
							this.getNode(),
							'Create relationship operation not implemented yet',
						);
					}
				} finally {
					await graph.close();
				}
			}
		} catch (error) {
			throw new NodeOperationError(this.getNode(), error as Error);
		} finally {
		}

		return [[]];
	}
}
