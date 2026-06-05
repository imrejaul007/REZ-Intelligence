Gem::Specification.new do |spec|
  spec.name          = 'rez-sdk'
  spec.version       = '1.0.0'
  spec.authors       = ['REZ Team']
  spec.email         = ['team@rez.io']
  spec.summary       = 'Ruby SDK for REZ Agent OS'
  spec.description   = 'A Ruby client for the REZ Agent OS ecosystem'
  spec.homepage      = 'https://github.com/rez-io/rez-ruby-sdk'
  spec.license       = 'MIT'
  spec.required_ruby_version = '>= 3.0'

  spec.files         = Dir['lib/**/*.rb']
  spec.require_paths = ['lib']

  spec.add_runtime_dependency 'json', '>= 2.0'

  spec.add_development_dependency 'bundler', '>= 2.0'
  spec.add_development_dependency 'rake', '~> 13.0'
  spec.add_development_dependency 'rspec', '~> 3.12'
end