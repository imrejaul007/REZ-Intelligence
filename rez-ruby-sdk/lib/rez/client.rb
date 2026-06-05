require_relative 'rez'

module REZ
  # Convenience method to create a new client
  def self.client(base_url: 'http://localhost:8080', api_key: nil, timeout: 30, max_retries: 3)
    Client.new(base_url: base_url, api_key: api_key, timeout: timeout, max_retries: max_retries)
  end

  # Convenience method with block
  def self.connect(base_url: 'http://localhost:8080', api_key: nil, timeout: 30, max_retries: 3)
    client = Client.new(base_url: base_url, api_key: api_key, timeout: timeout, max_retries: max_retries)
    yield client if block_given?
    client
  end
end