/**
 * Imports
 */
const project = process.cwd();
const inquirer = require('inquirer');
const init = require('../init');
const alerts = require('../helpers/alerts');
const utils = require('../helpers/utils');
const fs = require('fs-extra');
const fileSystem = require('../helpers/file-system');
const path = require('path');
const realRootPath = path.join(path.dirname(fs.realpathSync(__filename)), '../../');
const chalk = require("chalk");
const commonTags = require('common-tags');

module.exports = {

	/**
	 * Question the user about the project
	 */
	questionsAboutProject: () => {

		return new Promise(async (resolve, reject) => {
			
			exec();

			// Execute the promise
			async function exec() {

				const {
					name
				} = await getProjectName();

				const {
					technology
				} = await getProjectTechnology();

				await init.project(name, technology);

				return resolve({
					name,
					technology
				});

			}

			// Ask the user to get the project name
			function getProjectName() {

				return new Promise((resolve, reject) => {

					async function exec() {
						inquirer
							.prompt({
								message: 'How would you like to name the project?',
								type: 'input',
								name: 'name',
								filter: name => name ? `front.${name}.com.br` : '',
								validate: (name) => name !== ''
							}).then(answers => {

								const projectPath = `${project}/${answers.name}`;

								if (fs.existsSync(projectPath)) {

									alerts.error(`A project with this name already exists. Try another name!`);

									return exec();

								}

								resolve(answers);

							});
					}

					exec();

				});

			}

			// Ask the user to get the project technology
			function getProjectTechnology() {

				return new Promise((resolve, reject) => {

					inquirer
						.prompt(
							[{
								message: 'What technology do you want to use?',
								type: 'list',
								name: 'technology',
								choices: ['NodeJS', 'PHP']
							}]
						).then(answers => resolve(answers));

				});

			}

		});

	},

	/**
	 * Question the user about the repository
	 */
	questionsAboutRepository: (name) => {

		return new Promise(async (resolve, reject) => {

			exec();

			// Execute the promise
			async function exec() {

				inquirer
					.prompt({
						message: 'Do you like to create a repository?',
						type: "list",
						name: 'repository',
						choices: ["Yes, on Bitbucket.", "Yes, on Github.", "No, thanks."]
					}).then(async (answers) => {

						const response = answers.repository;

						switch (response) {

							case 'No!':
								resolve();
								break;

							case 'Yes, on Bitbucket.':
								await createRepo('bitbucket');
								resolve();
								break;

							case 'Yes, on Github.':
								await createRepo('github');
								resolve();
								break;

							default:
								alerts.error(`This option doesn't exist. Try a valid option or call --help.`);
								break;

						}

					});

			}

			// Initialize repository creation
			function createRepo(repository) {

				return new Promise(async (resolve, reject) => {

					exec();

					// Execute the promise
					async function exec() {

						let opts = {
							name,
							repository,
							owner: '',
							key: '',
							secret: '',
						}
						let oauthConfig = await getConfigJSON();

						opts.key = oauthConfig.key;
						opts.secret = oauthConfig.secret;

						if (repository === 'bitbucket') opts.owner = await getOwner();

						init
							.repository(opts)
							.then(() => {
								resolve();
							})
							.catch(async (err) => {

								const restart = await tryAgain();

								if (!restart) return resolve();

								setConfigJSON();

								setTimeout(() => exec(), 1000);

							});

					}

					// Ask the user if he wants to try again if some error happened
					function tryAgain() {

						return new Promise((resolve, reject) => {

							inquirer
								.prompt({
									message: `Do you want to try upload your repository on ${utils.jsUcfirst(repository)} again?` + chalk.gray(' (Y/n)'),
									type: 'input',
									name: 'try_again'
								}).then(response => {

									const result = response.try_again.toLowerCase() === 'y' ? true : false;

									resolve(result);

								});

						});

					}

					// Ask the user if he wants to change your OAuth key and secret
					function changeKeyAndSecret() {

						return new Promise((resolve, reject) => {

							inquirer
								.prompt({
									message: 'Looks like you already have a key and a secret, do you want to continue with them?' + chalk.gray(' (Y/n)'),
									type: 'input',
									name: 'continue'
								}).then(response => {

									const result = response.continue.toLowerCase() === 'y' ? true : false;

									resolve(result);

								});

						});

					}

					// Ask the user who is the owner of the project (only for Bitbucket repositories)
					function getOwner() {

						return new Promise((resolve, reject) => {

							inquirer
								.prompt({
									message: 'Who is the owner (username or organization username) of the project on Bitbucket?',
									type: 'input',
									name: 'owner',
									default: 'owinteractive',
									validate: owner => owner !== ''
								}).then(answers => resolve(answers.owner));

						});

					}

					// Ask the user to get your OAuth key and secret
					function getKeyAndSecret() {

						return new Promise((resolve, reject) => {

							let message;

							if (repository === 'bitbucket') {

								message = commonTags.html `
									To authorize the Bitbucket we need your OAuth Key/Secret. 
									If you don't have one go to Bitbucket -> Settings -> OAuth -> OAuth Consumers -> Add consumer.
									Inside the page set: name to "frontfy", callback URL to "http://localhost:3301/oauth-callback" and 
									give permission to Repositories (Write and Admin). Create and go ahead!
								`

							} else if (repository === 'github') {

								message = commonTags.html `
									To authorize the Github we need your OAuth Key/Secret. 
									If you don't have one go to Github -> Settings -> Developer settings -> OAuth Apps -> New OAuth App.
									Inside the page set: name to "frontfy", Homepage URL to "http://localhost:3301/" and 
									authorization callback URL to "http://localhost:3301/oauth-callback". Create and go ahead!
								`

							}

							alerts.warning(message);

							inquirer
								.prompt(
									[{
											message: 'Enter with your Client ID/Key: ',
											type: 'input',
											name: 'key',
											validate: key => key !== ''
										},
										{
											message: 'Enter with your Client Secret: ',
											type: 'input',
											name: 'secret',
											validate: secret => secret !== ''
										}
									]).then(answers => {

									const {
										key,
										secret
									} = answers;

									setConfigJSON(key, secret);

									return resolve({
										key,
										secret
									});

								});

						});

					}

					// Get the OAuth Key and Secret
					function getConfigJSON() {

						return new Promise(async (resolve, reject) => {

							try {

								let file = fs.readFileSync(`${realRootPath}config.json`);
								let {
									key,
									secret
								} = JSON.parse(file);

								if (!key && !secret) throw new Error("Oops! Key and secret are empty.");

								let keepKeyAndSecret = await changeKeyAndSecret();

								if (!keepKeyAndSecret) throw new Error("Oops! Change key and secret for another one.");

								return resolve({
									key,
									secret
								});

							} catch (err) {

								setConfigJSON();

								let {
									key,
									secret
								} = await getKeyAndSecret();

								return resolve({
									key,
									secret
								});

							}

						});

					}

					// Set the OAuth Key and Secret
					function setConfigJSON(key = "", secret = "") {

						return new Promise(async (resolve, reject) => {

							const file = path.resolve(`${realRootPath}config.json`);
							const fileContent = {
								key,
								secret
							}
				
							await fileSystem.createFile(file, JSON.stringify(fileContent));
				
							resolve();
				
						});

					}

				});

			}

		});

	},

	/**
	 * Question the user about the project initialization
	 */
	questionsAboutInitialization: (name) => {

		return new Promise((resolve, reject) => {

			inquirer
				.prompt({
					message: 'Do you like to run the project?' + chalk.gray(' (Y/n)'),
					type: 'input',
					name: 'run'
				}).then(answer => {

					if (answer.run.toLowerCase() === 'y') {

						return init.run(name);

					} else {

						alerts.success(`All done! Enter "cd ${name} && npm run build" in the console to start the app. PS: Remember to configurate the .env file in /config.`);
						resolve();

					}

				});

		});

	}

}