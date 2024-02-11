from setuptools import setup, find_packages

setup(
    name='wifi-lights',
    version='0.0.1',
    description='Packet pour la gestion des ampoules connectées Tuya. Et autres appareils connectés.',
    author='Gwendal Delisle-Arnold',
    author_email='gwendalda@gmail.com',
    packages=find_packages(),
    package_dir={'wifi-lights': 'src'},
    install_requires=[
        'tinytuya',
        'overrides'
    ],
    classifiers=[
        'Development Status :: 5 - Initial Development',
        'Intended Audience :: Developers',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.6',
        'Programming Language :: Python :: 3.7',
        'Programming Language :: Python :: 3.8',
    ],
)