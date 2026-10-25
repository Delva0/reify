// Copied from pajecawav/ghloc-web, efb19a82421543b34775940837d73d90b231ce95.
// Copyright (c) 2025 pajecawav. MIT; see LICENSE.
export const getRawGitHubFileUrl = (
	owner: string,
	repo: string,
	branch: string,
	path: string,
) => {
	return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
};

export const getGitHubFileUrl = (
	owner: string,
	repo: string,
	branch: string,
	path: string,
) => {
	return `https://github.com/${owner}/${repo}/blob/${branch}/${path}`;
};
