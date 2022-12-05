import { publish } from 'gh-pages';

publish(
    'build', // path to public directory
    {
        branch: 'gh-pages',
        repo: 'https://github.com/Seo-Rii/Seo-Rii.github.io.git', // Update to point to your repository
        user: {
            name: 'Seohyun Lee', // update to use your name
            email: 'me@seorii.page' // Update to use your email
        },
        dotfiles: true
    },
    () => {
        console.log('Deploy Complete!');
    }
);