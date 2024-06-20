import {
	ICredentialType,
	NodePropertyTypes,
	IAuthenticateGeneric,
	ICredentialTestRequest
} from 'n8n-workflow';


export class Neo4j implements ICredentialType {
	name = 'neo4j';
	displayName = 'Neo4j';
	properties = [
		// The credentials to get from user and save encrypted.
		// Properties can be defined exactly in the same way
		// as node properties.
		{
			displayName: 'Username',
			name: 'username',
			type: 'string' as NodePropertyTypes,
			default: 'neo4j',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string' as NodePropertyTypes,
			default: '',
		},
		{
			displayName: 'Database',
			name: 'database',
			type: 'string' as NodePropertyTypes,
			default: 'neo4j',
		},
		{
			displayName: 'Url',
			name: 'url',
			type: 'string' as NodePropertyTypes,
			default: 'http://localhost:7474',
		},
	];
	authenticate = {
		type: 'generic',
		properties: {
			auth: {
				username: '={{$credentials.username}}',
				password: '={{$credentials.password}}',
			},
		},
	} as IAuthenticateGeneric;
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.url}}',
			url: '/db/{{$credentials.database}}/tx/commits',
		},
	};
}
